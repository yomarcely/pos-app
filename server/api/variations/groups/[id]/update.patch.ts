import { db } from '~/server/database/connection'
import { variationGroups } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateVariationGroupSchema, type UpdateVariationGroupInput } from '~/server/validators/variation.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Mettre à jour un groupe de variation
 * ==========================================
 *
 * PATCH /api/variations/groups/:id/update
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)
    const body = await validateBody<UpdateVariationGroupInput>(event, updateVariationGroupSchema)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de groupe invalide',
      })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()

    // Mettre à jour - SÉCURITÉ: filtre par tenantId ET id
    const [updated] = await db
      .update(variationGroups)
      .set(updateData)
      .where(
        and(
          eq(variationGroups.id, id),
          eq(variationGroups.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Groupe de variation introuvable',
      })
    }

    logger.info(`Groupe de variation mis à jour: ${updated.name}`)

    return {
      success: true,
      message: 'Groupe de variation mis à jour avec succès',
      group: updated,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour du groupe de variation')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
