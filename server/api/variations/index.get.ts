import { db } from '~/server/database/connection'
import { variationGroups, variations, syncGroupEstablishments } from '~/server/database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer tous les groupes de variations avec leurs variations
 * ==========================================
 *
 * GET /api/variations
 *
 * Retourne la liste de tous les groupes de variations non archivés avec leurs variations
 * Supporte le paramètre establishmentId pour filtrer par établissement
 */

interface Variation {
  id: number
  name: string
  sortOrder: number | null
}

interface VariationGroup {
  id: number
  name: string
  variations: Variation[]
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    let groups

    // Si un établissement est spécifié
    if (establishmentId) {
      // Récupérer les groupes de sync auxquels appartient cet établissement
      const syncGroupIds = await db
        .select({ syncGroupId: syncGroupEstablishments.syncGroupId })
        .from(syncGroupEstablishments)
        .where(
          and(
            eq(syncGroupEstablishments.tenantId, tenantId),
            eq(syncGroupEstablishments.establishmentId, establishmentId)
          )
        )

      let allowedEstablishmentIds = [establishmentId]

      // Si l'établissement est dans un groupe de sync, inclure aussi les autres établissements du groupe
      if (syncGroupIds.length > 0) {
        const groupEstablishments = await db
          .select({ establishmentId: syncGroupEstablishments.establishmentId })
          .from(syncGroupEstablishments)
          .where(
            and(
              eq(syncGroupEstablishments.tenantId, tenantId),
              inArray(syncGroupEstablishments.syncGroupId, syncGroupIds.map(g => g.syncGroupId))
            )
          )

        allowedEstablishmentIds = groupEstablishments.map(e => e.establishmentId)
      }

      // Retourner les groupes créés par l'établissement OU par les établissements du même groupe
      groups = await db
        .select()
        .from(variationGroups)
        .where(
          and(
            eq(variationGroups.tenantId, tenantId),
            inArray(variationGroups.createdByEstablishmentId, allowedEstablishmentIds),
            eq(variationGroups.isArchived, false)
          )
        )
    } else {
      // Sans établissement, retourner tous les groupes du tenant
      groups = await db
        .select()
        .from(variationGroups)
        .where(
          and(
            eq(variationGroups.tenantId, tenantId),
            eq(variationGroups.isArchived, false)
          )
        )
    }

    // Récupérer les variations des groupes (filtrées par les groupes obtenus)
    const groupIds = groups.map(g => g.id)
    let allVariations: any[] = []
    if (groupIds.length > 0) {
      allVariations = await db
        .select()
        .from(variations)
        .where(
          and(
            eq(variations.tenantId, tenantId),
            eq(variations.isArchived, false)
          )
        )
    }

    // Construire la structure avec les variations groupées
    const result: VariationGroup[] = groups.map(group => ({
      id: group.id,
      name: group.name,
      variations: allVariations
        .filter((v: any) => v.groupId === group.id)
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((v: any) => ({
          id: v.id,
          name: v.name,
          sortOrder: v.sortOrder,
        })),
    }))

    return {
      success: true,
      groups: result,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des variations')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
