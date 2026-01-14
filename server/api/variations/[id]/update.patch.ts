import { db } from '~/server/database/connection'
import { variations } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateVariationSchema, type UpdateVariationInput } from '~/server/validators/variation.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Mettre à jour une variation
 * ==========================================
 *
 * PATCH /api/variations/:id/update
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)
    const body = await validateBody<UpdateVariationInput>(event, updateVariationSchema)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de variation invalide',
      })
    }

    // Vérifier que la variation existe
    const [existing] = await db.select().from(variations).where(
      and(
        eq(variations.id, id),
        eq(variations.tenantId, tenantId),
      )
    ).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Variation introuvable',
      })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder

    const [updated] = await db
      .update(variations)
      .set(updateData)
      .where(
        and(
          eq(variations.id, id),
          eq(variations.tenantId, tenantId),
        )
      )
      .returning()

    logger.info(`Variation mise à jour: ${updated.name}`)

    return {
      success: true,
      message: 'Variation mise à jour avec succès',
      variation: updated,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour de la variation')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
