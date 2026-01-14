import { db } from '~/server/database/connection'
import { sellers, sellerEstablishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer tous les vendeurs
 * ==========================================
 *
 * GET /api/sellers
 * GET /api/sellers?establishmentId=1
 *
 * Retourne la liste de tous les vendeurs non archivés pour le tenant
 * Optionnel: Filtrer par établissement
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : null

    // Si filtrage par établissement
    if (establishmentId) {
      const sellersWithEstablishments = await db
        .select({
          id: sellers.id,
          name: sellers.name,
          code: sellers.code,
          isActive: sellers.isActive,
          createdAt: sellers.createdAt,
          updatedAt: sellers.updatedAt,
        })
        .from(sellers)
        .innerJoin(
          sellerEstablishments,
          and(
            eq(sellerEstablishments.sellerId, sellers.id),
            eq(sellerEstablishments.establishmentId, establishmentId),
            eq(sellerEstablishments.tenantId, tenantId)
          )
        )
        .where(
          and(
            eq(sellers.tenantId, tenantId),
            eq(sellers.isActive, true)
          )
        )
        .orderBy(sellers.name)

      return {
        success: true,
        sellers: sellersWithEstablishments,
      }
    }

    // Sinon, récupérer tous les vendeurs actifs
    const allSellers = await db
      .select()
      .from(sellers)
      .where(
        and(
          eq(sellers.tenantId, tenantId),
          eq(sellers.isActive, true)
        )
      )
      .orderBy(sellers.name)

    return {
      success: true,
      sellers: allSellers,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des vendeurs')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
