import { db } from '~/server/database/connection'
import { customers, sales } from '~/server/database/schema'
import { eq, sql, count } from 'drizzle-orm'

/**
 * ==========================================
 * API: Récupérer les statistiques d'un client
 * ==========================================
 *
 * GET /api/clients/:id/stats
 *
 * Retourne les statistiques d'un client (CA total, nombre d'achats, points)
 */

export default defineEventHandler(async (event) => {
  try {
    const id = parseInt(getRouterParam(event, 'id') || '0')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID client invalide',
      })
    }

    // Vérifier si le client existe
    const [client] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1)

    if (!client) {
      throw createError({
        statusCode: 404,
        message: 'Client non trouvé',
      })
    }

    // Récupérer le nombre d'achats
    const purchaseCountResult = await db
      .select({
        count: count(),
      })
      .from(sales)
      .where(
        sql`${sales.customerId} = ${id} AND ${sales.status} = 'completed'`
      )

    // Récupérer le CA total
    const revenueResult = await db
      .select({
        totalRevenue: sql<string>`SUM(${sales.totalTTC})`,
      })
      .from(sales)
      .where(
        sql`${sales.customerId} = ${id} AND ${sales.status} = 'completed'`
      )

    const totalRevenue = revenueResult[0]?.totalRevenue
      ? parseFloat(revenueResult[0].totalRevenue)
      : 0

    const purchaseCount = purchaseCountResult[0]?.count || 0

    // TODO: Implémenter le calcul réel des points de fidélité
    // Pour l'instant, 1 point par euro dépensé
    const loyaltyPoints = client.loyaltyProgram ? Math.floor(totalRevenue) : 0

    return {
      success: true,
      totalRevenue,
      purchaseCount,
      loyaltyPoints,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
