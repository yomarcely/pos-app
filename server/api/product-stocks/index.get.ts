import { db } from '~/server/database/connection'
import { productStocks, products, establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer les stocks par établissement
 * ==========================================
 *
 * GET /api/product-stocks?establishmentId=xxx&lowStock=true
 *
 * Retourne les stocks des produits avec filtres optionnels
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)

    const establishmentId = query.establishmentId ? parseInt(query.establishmentId as string) : undefined
    const lowStock = query.lowStock === 'true'
    const outOfStock = query.outOfStock === 'true'
    const productId = query.productId ? parseInt(query.productId as string) : undefined

    // Construction de la requête
    const conditions = [eq(productStocks.tenantId, tenantId)]

    if (establishmentId) {
      conditions.push(eq(productStocks.establishmentId, establishmentId))
    }

    if (productId) {
      conditions.push(eq(productStocks.productId, productId))
    }

    const queryBuilder = db
      .select({
        id: productStocks.id,
        productId: productStocks.productId,
        productName: products.name,
        productBarcode: products.barcode,
        establishmentId: productStocks.establishmentId,
        establishmentName: establishments.name,
        stock: productStocks.stock,
        stockByVariation: productStocks.stockByVariation,
        minStock: productStocks.minStock,
        minStockByVariation: productStocks.minStockByVariation,
        updatedAt: productStocks.updatedAt,
      })
      .from(productStocks)
      .innerJoin(products, eq(productStocks.productId, products.id))
      .innerJoin(establishments, eq(productStocks.establishmentId, establishments.id))
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])

    let stocks = (await queryBuilder).map((s) => ({
      ...s,
      stock: s.stock ?? 0,
      minStock: s.minStock ?? 0,
    }))

    // Filtres post-requête pour stock faible et rupture
    if (lowStock) {
      stocks = stocks.filter(s => s.stock < s.minStock && s.stock > 0)
    }

    if (outOfStock) {
      stocks = stocks.filter(s => s.stock === 0)
    }

    // Calcul des alertes de stock
    const alerts = stocks
      .filter(s => s.stock <= s.minStock)
      .map(s => ({
        productId: s.productId,
        productName: s.productName,
        establishmentId: s.establishmentId,
        establishmentName: s.establishmentName,
        currentStock: s.stock,
        minStock: s.minStock,
        severity: s.stock === 0 ? 'critical' : 'low',
      }))

    return {
      success: true,
      stocks,
      alerts,
      totalProducts: stocks.length,
      lowStockCount: stocks.filter(s => s.stock < s.minStock && s.stock > 0).length,
      outOfStockCount: stocks.filter(s => s.stock === 0).length,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des stocks')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
