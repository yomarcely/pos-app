import { db } from '~/server/database/connection'
import { sellerEstablishments, establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer les établissements d'un vendeur
 * ==========================================
 *
 * GET /api/sellers/:id/establishments
 *
 * Retourne la liste des établissements affectés à un vendeur
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const sellerId = Number(event.context.params?.id)

    if (!sellerId || isNaN(sellerId)) {
      throw createError({
        statusCode: 400,
        message: 'ID de vendeur invalide',
      })
    }

    const sellerEstabs = await db
      .select({
        id: establishments.id,
        name: establishments.name,
        address: establishments.address,
        city: establishments.city,
      })
      .from(sellerEstablishments)
      .innerJoin(
        establishments,
        eq(sellerEstablishments.establishmentId, establishments.id)
      )
      .where(
        and(
          eq(sellerEstablishments.sellerId, sellerId),
          eq(sellerEstablishments.tenantId, tenantId)
        )
      )

    return {
      success: true,
      establishments: sellerEstabs,
      establishmentIds: sellerEstabs.map(e => e.id),
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des établissements du vendeur')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
