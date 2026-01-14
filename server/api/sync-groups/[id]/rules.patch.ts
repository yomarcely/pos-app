import { db } from '~/server/database/connection'
import { syncRules, syncGroups } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { updateSyncRulesSchema } from '~/server/validators/sync.schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Modifier les règles de synchronisation
 * ==========================================
 *
 * PATCH /api/sync-groups/:id/rules
 *
 * Met à jour les règles de synchronisation d'un groupe
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = parseInt(getRouterParam(event, 'id') || '0')
    const body = await readBody(event)

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID du groupe invalide',
      })
    }

    // Validation des données
    const validatedData = updateSyncRulesSchema.parse(body)

    // Vérifier que le groupe existe et appartient au tenant
    const [group] = await db
      .select()
      .from(syncGroups)
      .where(and(eq(syncGroups.id, id), eq(syncGroups.tenantId, tenantId)))

    if (!group) {
      throw createError({
        statusCode: 404,
        message: 'Groupe de synchronisation non trouvé',
      })
    }

    // Mettre à jour les règles
    const [updatedRules] = await db
      .update(syncRules)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(syncRules.syncGroupId, id),
          eq(syncRules.entityType, validatedData.entityType)
        )
      )
      .returning()

    return {
      success: true,
      rules: updatedRules,
      message: 'Règles de synchronisation mises à jour avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour des règles')

    // Erreur de validation Zod
    if (error && typeof error === 'object' && 'issues' in error) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
        data: error,
      })
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
