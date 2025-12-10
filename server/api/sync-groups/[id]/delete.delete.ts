import { db } from '~/server/database/connection'
import { syncGroups } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Supprimer un groupe de synchronisation
 * ==========================================
 *
 * DELETE /api/sync-groups/:id
 *
 * Supprime un groupe de sync (suppression en cascade)
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = parseInt(getRouterParam(event, 'id') || '0')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID du groupe invalide',
      })
    }

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

    // Supprimer le groupe (la suppression en cascade supprimera automatiquement
    // les liaisons dans sync_group_establishments et sync_rules)
    await db
      .delete(syncGroups)
      .where(and(eq(syncGroups.id, id), eq(syncGroups.tenantId, tenantId)))

    return {
      success: true,
      message: 'Groupe de synchronisation supprimé avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du groupe:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
