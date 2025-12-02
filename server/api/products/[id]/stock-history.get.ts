import { db } from '~/server/database/connection'
import { stockMovements, products, movements, sales } from '~/server/database/schema'
import { eq, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

/**
 * ==========================================
 * API: Récupérer l'historique des mouvements de stock d'un produit
 * ==========================================
 *
 * GET /api/products/:id/stock-history
 */

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID du produit manquant',
      })
    }

    const productId = parseInt(id)

    // Vérifier que le produit existe
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product) {
      throw createError({
        statusCode: 404,
        message: 'Produit non trouvé',
      })
    }

    // Récupérer tous les mouvements de stock pour ce produit avec les infos du mouvement parent
    const stockMovs = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        variation: stockMovements.variation,
        quantity: stockMovements.quantity,
        oldStock: stockMovements.oldStock,
        newStock: stockMovements.newStock,
        reason: stockMovements.reason,
        userId: stockMovements.userId,
        createdAt: stockMovements.createdAt,
        saleId: stockMovements.saleId,
        movementId: stockMovements.movementId,
        movementNumber: movements.movementNumber,
        movementComment: movements.comment,
        saleTicket: sales.ticketNumber,
      })
      .from(stockMovements)
      .leftJoin(movements, eq(stockMovements.movementId, movements.id))
      .leftJoin(sales, eq(stockMovements.saleId, sales.id))
      .where(eq(stockMovements.productId, productId))
      .orderBy(desc(stockMovements.createdAt))

    // Mapper les champs pour le frontend
    const formattedMovements = stockMovs.map(m => ({
      id: m.id,
      productId: m.productId,
      variation: m.variation,
      quantity: m.quantity,
      previousStock: m.oldStock,
      newStock: m.newStock,
      reason: m.reason,
      userId: m.userId,
      createdAt: m.createdAt,
      saleId: m.saleId,
      movementId: m.movementId,
      movementNumber: m.movementNumber,
      movementComment: m.movementComment,
      receiptNumber: null, // À ajouter si vous avez une table receipts
      saleTicket: m.saleTicket || null,
    }))

    console.log(`📊 ${stockMovs.length} mouvement(s) de stock récupéré(s) pour le produit #${productId}`)

    return {
      success: true,
      movements: formattedMovements,
      count: formattedMovements.length,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
