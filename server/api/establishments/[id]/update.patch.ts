import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateEstablishmentSchema, type UpdateEstablishmentInput } from '~/server/validators/establishment.schema'

/**
 * ==========================================
 * API: Mettre à jour un établissement
 * ==========================================
 *
 * PATCH /api/establishments/:id/update
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)
    const body = await validateBody<UpdateEstablishmentInput>(event, updateEstablishmentSchema)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID d\'établissement invalide',
      })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.address !== undefined) updateData.address = body.address?.trim() || null
    if (body.postalCode !== undefined) updateData.postalCode = body.postalCode?.trim() || null
    if (body.city !== undefined) updateData.city = body.city?.trim() || null
    if (body.country !== undefined) updateData.country = body.country?.trim() || null
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null
    if (body.email !== undefined) updateData.email = body.email?.trim() || null
    if (body.siret !== undefined) updateData.siret = body.siret?.trim() || null
    if (body.naf !== undefined) updateData.naf = body.naf?.trim() || null
    if (body.tvaNumber !== undefined) updateData.tvaNumber = body.tvaNumber?.trim() || null
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Mettre à jour - SÉCURITÉ: filtre par tenantId ET id
    const [updated] = await db
      .update(establishments)
      .set(updateData)
      .where(
        and(
          eq(establishments.id, id),
          eq(establishments.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Établissement introuvable',
      })
    }

    console.log(`✅ Établissement mis à jour: ${updated.name}`)

    return {
      success: true,
      message: 'Établissement mis à jour avec succès',
      establishment: updated,
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'établissement:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
