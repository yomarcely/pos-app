import { db } from '~/server/database/connection'
import { sellers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateSellerSchema, type UpdateSellerInput } from '~/server/validators/seller.schema'

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

    console.log(`✅ Vendeur mis à jour: ${updated.name}`)

    return {
      success: true,
      message: 'Vendeur mis à jour avec succès',
      seller: updated,
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du vendeur:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
