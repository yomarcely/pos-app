import { db } from '~/server/database/connection'
import { stockMovements, products } from '~/server/database/schema'
import { desc, eq, ne, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer l'historique des mouvements de stock
 * ==========================================
 *
 * GET /api/products/stock-movements
 *
 * Query params (optionnel):
 * - productId: number - Filtrer par produit
 * - limit: number - Limiter le nombre de résultats (défaut: 100)
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const productId = query.productId ? Number(query.productId) : null
    const limit = query.limit ? Number(query.limit) : 100

    // Récupérer les mouvements de stock (seulement les ajustements, pas les ventes)
    let whereConditions = [
      ne(stockMovements.reason, 'sale'),
      ne(stockMovements.reason, 'sale_cancellation'),
      eq(stockMovements.tenantId, tenantId),
    ]

    // Filtrer par produit si spécifié
    if (productId) {
      whereConditions.push(eq(stockMovements.productId, productId))
    }

    const movements = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        variation: stockMovements.variation,
        quantity: stockMovements.quantity,
        oldStock: stockMovements.oldStock,
        newStock: stockMovements.newStock,
        reason: stockMovements.reason,
        saleId: stockMovements.saleId,
        userId: stockMovements.userId,
        createdAt: stockMovements.createdAt,
        productName: products.name,
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .where(and(...whereConditions))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit)

    // Transformer les données pour correspondre au format attendu par le frontend
    const formattedMovements = movements.map(movement => ({
      id: movement.id,
      productId: movement.productId,
      productName: movement.productName || 'Produit inconnu',
      variation: movement.variation || '',
      quantity: movement.quantity,
      oldStock: movement.oldStock,
      newStock: movement.newStock,
      reason: movement.reason,
      saleId: movement.saleId,
      userId: movement.userId,
      date: movement.createdAt,
    }))

    return {
      success: true,
      movements: formattedMovements,
      count: formattedMovements.length,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération de l\'historique')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
