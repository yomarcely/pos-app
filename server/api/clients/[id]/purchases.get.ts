import { db } from '~/server/database/connection'
import { customers, sales, saleItems } from '~/server/database/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * ==========================================
 * API: Récupérer l'historique des achats d'un client
 * ==========================================
 *
 * GET /api/clients/:id/purchases
 *
 * Retourne la liste des achats effectués par un client
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

    // Récupérer toutes les ventes du client
    const clientSales = await db
      .select({
        id: sales.id,
        ticketNumber: sales.ticketNumber,
        saleDate: sales.saleDate,
        totalHT: sales.totalHT,
        totalTVA: sales.totalTVA,
        totalTTC: sales.totalTTC,
        status: sales.status,
        payments: sales.payments,
      })
      .from(sales)
      .where(eq(sales.customerId, id))
      .orderBy(desc(sales.saleDate))

    // Pour chaque vente, récupérer les articles
    const purchasesWithItems = await Promise.all(
      clientSales.map(async (sale) => {
        // Récupérer tous les articles de la vente
        const items = await db
          .select({
            id: saleItems.id,
            productName: saleItems.productName,
            variation: saleItems.variation,
            quantity: saleItems.quantity,
            unitPrice: saleItems.unitPrice,
            totalTTC: saleItems.totalTTC,
            discount: saleItems.discount,
            discountType: saleItems.discountType,
            originalPrice: saleItems.originalPrice,
            tva: saleItems.tva,
          })
          .from(saleItems)
          .where(eq(saleItems.saleId, sale.id))

        return {
          ...sale,
          items,
          itemCount: items.length,
        }
      })
    )

    return {
      success: true,
      purchases: purchasesWithItems,
      count: purchasesWithItems.length,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des achats:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
