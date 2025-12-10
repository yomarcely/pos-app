import { db } from '~/server/database/connection'
import { syncGroups, syncGroupEstablishments, establishments, syncRules } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Récupérer un groupe de synchronisation
 * ==========================================
 *
 * GET /api/sync-groups/:id
 *
 * Retourne les détails d'un groupe de sync avec ses établissements et règles
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

    // Récupérer le groupe
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

    // Récupérer les établissements du groupe
    const groupEstablishments = await db
      .select({
        id: establishments.id,
        name: establishments.name,
        city: establishments.city,
        address: establishments.address,
        postalCode: establishments.postalCode,
      })
      .from(syncGroupEstablishments)
      .innerJoin(
        establishments,
        eq(syncGroupEstablishments.establishmentId, establishments.id)
      )
      .where(eq(syncGroupEstablishments.syncGroupId, group.id))

    // Récupérer les règles du groupe
    const rules = await db
      .select()
      .from(syncRules)
      .where(eq(syncRules.syncGroupId, group.id))

    const productRules = rules.find(r => r.entityType === 'product')
    const customerRules = rules.find(r => r.entityType === 'customer')

    return {
      success: true,
      syncGroup: {
        ...group,
        establishments: groupEstablishments,
        establishmentCount: groupEstablishments.length,
        productRules,
        customerRules,
      },
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du groupe de synchronisation:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
