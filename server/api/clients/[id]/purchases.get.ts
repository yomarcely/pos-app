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
 *
 * Performance: Utilise un LEFT JOIN pour éviter N+1 queries
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

    // Récupérer toutes les ventes avec leurs articles en une seule requête
    const salesWithItems = await db
      .select({
        saleId: sales.id,
        ticketNumber: sales.ticketNumber,
        saleDate: sales.saleDate,
        totalHT: sales.totalHT,
        totalTVA: sales.totalTVA,
        totalTTC: sales.totalTTC,
        status: sales.status,
        payments: sales.payments,
        // Articles
        itemId: saleItems.id,
        productName: saleItems.productName,
        variation: saleItems.variation,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        itemTotalTTC: saleItems.totalTTC,
        discount: saleItems.discount,
        discountType: saleItems.discountType,
        originalPrice: saleItems.originalPrice,
        tva: saleItems.tva,
      })
      .from(sales)
      .leftJoin(saleItems, eq(sales.id, saleItems.saleId))
      .where(eq(sales.customerId, id))
      .orderBy(desc(sales.saleDate))

    // Grouper les résultats par vente
    const purchasesMap = new Map<number, any>()

    for (const row of salesWithItems) {
      if (!purchasesMap.has(row.saleId)) {
        purchasesMap.set(row.saleId, {
          id: row.saleId,
          ticketNumber: row.ticketNumber,
          saleDate: row.saleDate,
          totalHT: row.totalHT,
          totalTVA: row.totalTVA,
          totalTTC: row.totalTTC,
          status: row.status,
          payments: row.payments,
          items: [],
        })
      }

      // Ajouter l'article si présent (LEFT JOIN peut retourner null)
      if (row.itemId) {
        purchasesMap.get(row.saleId)!.items.push({
          id: row.itemId,
          productName: row.productName,
          variation: row.variation,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          totalTTC: row.itemTotalTTC,
          discount: row.discount,
          discountType: row.discountType,
          originalPrice: row.originalPrice,
          tva: row.tva,
        })
      }
    }

    // Convertir en tableau et ajouter itemCount
    const purchasesWithItems = Array.from(purchasesMap.values()).map(purchase => ({
      ...purchase,
      itemCount: purchase.items.length,
    }))

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
