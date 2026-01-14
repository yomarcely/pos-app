import { db } from '~/server/database/connection'
import { variations, variationGroups } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createVariationSchema, type CreateVariationInput } from '~/server/validators/variation.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Créer une variation
 * ==========================================
 *
 * POST /api/variations/create
 *
 * Crée une nouvelle variation dans un groupe (ex: "Rouge", "Bleu", "S", "M", "L")
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    const body = await validateBody<CreateVariationInput>(event, createVariationSchema)

    // Vérifier que le groupe existe
    const [group] = await db.select().from(variationGroups).where(eq(variationGroups.id, body.groupId)).limit(1)

    if (!group) {
      throw createError({
        statusCode: 404,
        message: 'Groupe de variation introuvable',
      })
    }

    const [newVariation] = await db.insert(variations).values({
      tenantId,
      groupId: body.groupId,
      name: body.name.trim(),
      sortOrder: body.sortOrder || 0,
    }).returning()

    logger.info({
      variationId: newVariation.id,
      variationName: newVariation.name,
      groupId: body.groupId,
      groupName: group.name,
      tenantId
    }, 'Variation created')

    return {
      success: true,
      message: 'Variation créée avec succès',
      variation: newVariation,
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to create variation')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
