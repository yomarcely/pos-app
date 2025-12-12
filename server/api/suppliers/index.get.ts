import { db } from '~/server/database/connection'
import { suppliers, syncGroupEstablishments } from '~/server/database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    let allSuppliers

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

      // Retourner les fournisseurs créés par l'établissement OU par les établissements du même groupe
      allSuppliers = await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.tenantId, tenantId),
            inArray(suppliers.createdByEstablishmentId, allowedEstablishmentIds),
            eq(suppliers.isArchived, false)
          )
        )
        .orderBy(suppliers.name)
    } else {
      // Sans établissement, retourner tous les fournisseurs du tenant
      allSuppliers = await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.tenantId, tenantId),
            eq(suppliers.isArchived, false)
          )
        )
        .orderBy(suppliers.name)
    }

    return allSuppliers
  }
  catch (error: any) {
    console.error('Erreur lors de la récupération des fournisseurs:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des fournisseurs',
    })
  }
})
