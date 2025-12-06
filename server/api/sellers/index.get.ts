import { db } from '~/server/database/connection'
import { sellers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Récupérer tous les vendeurs
 * ==========================================
 *
 * GET /api/sellers
 *
 * Retourne la liste de tous les vendeurs non archivés pour le tenant
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    // Récupérer tous les vendeurs actifs
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
    console.error('Erreur lors de la récupération des vendeurs:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
