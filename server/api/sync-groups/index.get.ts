import { db } from '~/server/database/connection'
import { syncGroups, syncGroupEstablishments, establishments, syncRules } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Récupérer tous les groupes de synchronisation
 * ==========================================
 *
 * GET /api/sync-groups
 *
 * Retourne la liste de tous les groupes de sync avec leurs établissements
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    // Récupérer tous les groupes de sync du tenant
    const groups = await db
      .select()
      .from(syncGroups)
      .where(eq(syncGroups.tenantId, tenantId))
      .orderBy(syncGroups.name)

    // Pour chaque groupe, récupérer les établissements et les règles
    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        // Récupérer les établissements du groupe
        const groupEstablishments = await db
          .select({
            id: establishments.id,
            name: establishments.name,
            city: establishments.city,
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
          ...group,
          establishments: groupEstablishments,
          establishmentCount: groupEstablishments.length,
          productRules,
          customerRules,
        }
      })
    )

    return {
      success: true,
      syncGroups: groupsWithDetails,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des groupes de synchronisation:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
