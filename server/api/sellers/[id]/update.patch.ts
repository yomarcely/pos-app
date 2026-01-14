import { db } from '~/server/database/connection'
import { sellers, sellerEstablishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateSellerSchema, type UpdateSellerInput } from '~/server/validators/seller.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Mettre à jour un vendeur
 * ==========================================
 *
 * PATCH /api/sellers/:id/update
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)
    const body = await validateBody<UpdateSellerInput>(event, updateSellerSchema)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de vendeur invalide',
      })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.code !== undefined) updateData.code = body.code?.trim() || null
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Mettre à jour - SÉCURITÉ: filtre par tenantId ET id
    const [updated] = await db
      .update(sellers)
      .set(updateData)
      .where(
        and(
          eq(sellers.id, id),
          eq(sellers.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Vendeur introuvable',
      })
    }

    // Mettre à jour les affectations établissements si fourni
    if (body.establishmentIds !== undefined) {
      // Supprimer les anciennes affectations
      await db
        .delete(sellerEstablishments)
        .where(
          and(
            eq(sellerEstablishments.sellerId, id),
            eq(sellerEstablishments.tenantId, tenantId)
          )
        )

      // Ajouter les nouvelles affectations
      if (body.establishmentIds.length > 0) {
        await db.insert(sellerEstablishments).values(
          body.establishmentIds.map(establishmentId => ({
            tenantId,
            sellerId: id,
            establishmentId,
          }))
        )
      }
    }

    logger.info(`Vendeur mis à jour: ${updated.name} (${body.establishmentIds?.length || '?'} établissement(s))`)

    return {
      success: true,
      message: 'Vendeur mis à jour avec succès',
      seller: updated,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour du vendeur')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
