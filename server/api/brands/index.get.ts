import { db } from '~/server/database/connection'
import { brands, syncGroupEstablishments } from '~/server/database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    let allBrands

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

      // Retourner les marques créées par l'établissement OU par les établissements du même groupe
      allBrands = await db
        .select()
        .from(brands)
        .where(
          and(
            eq(brands.tenantId, tenantId),
            inArray(brands.createdByEstablishmentId, allowedEstablishmentIds),
            eq(brands.isArchived, false)
          )
        )
        .orderBy(brands.name)
    } else {
      // Sans établissement, retourner toutes les marques du tenant
      allBrands = await db
        .select()
        .from(brands)
        .where(
          and(
            eq(brands.tenantId, tenantId),
            eq(brands.isArchived, false)
          )
        )
        .orderBy(brands.name)
    }

    return allBrands
  }
  catch (error: any) {
    console.error('Erreur lors de la récupération des marques:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des marques',
    })
  }
})
