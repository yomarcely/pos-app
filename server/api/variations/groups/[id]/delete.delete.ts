import { db } from '~/server/database/connection'
import { variationGroups, variations } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Supprimer un groupe de variation
 * ==========================================
 *
 * DELETE /api/variations/groups/:id/delete
 *
 * Suppression soft (archivage)
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de groupe invalide',
      })
    }

    // Vérifier que le groupe existe
    const [existing] = await db.select().from(variationGroups).where(
      and(
        eq(variationGroups.id, id),
        eq(variationGroups.tenantId, tenantId),
      )
    ).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Groupe de variation introuvable',
      })
    }

    // Vérifier s'il y a des variations dans ce groupe
    const variationsInGroup = await db.select().from(variations).where(
      and(
        eq(variations.groupId, id),
        eq(variations.tenantId, tenantId),
      )
    )

    if (variationsInGroup.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Impossible de supprimer un groupe contenant ${variationsInGroup.length} variation(s)`,
      })
    }

    // Soft delete
    await db
      .update(variationGroups)
      .set({
        isArchived: true,
        archivedAt: new Date(),
      })
      .where(
        and(
          eq(variationGroups.id, id),
          eq(variationGroups.tenantId, tenantId),
        )
      )

    logger.info(`Groupe de variation archivé: ${existing.name}`)

    return {
      success: true,
      message: 'Groupe de variation supprimé avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression du groupe de variation')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
