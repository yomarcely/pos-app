import { db } from '~/server/database/connection'
import { sales, saleItems, products, productStocks } from '~/server/database/schema'
import { and, eq, gte, lt, inArray, sql, desc, asc, notInArray } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { parseIdsParam } from '~/server/utils/revenueStats'

/**
 * GET /api/stats/products
 *
 * Statistiques produits sur la période :
 *   - topSelling : top 20 produits par CA TTC
 *   - dormant   : produits sans vente sur la période (limit 50)
 *   - rotation  : produits actifs triés par jours d'écoulement décroissant
 *                 (sur-stocks d'abord — produits qui prennent du temps à se vendre)
 *
 * Query params : startDate, endDate, establishmentId (CSV multi).
 *
 * Pour rotation : le stock est sommé sur les établissements filtrés
 * (ou tous les établissements du tenant si pas de filtre).
 */

const TOP_LIMIT = 20
const DORMANT_LIMIT = 50
const ROTATION_LIMIT = 50

function parseDate(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    throw createError({
      statusCode: 400,
      message: `Date invalide : ${raw} (format attendu : YYYY-MM-DD)`,
    })
  }
  return d
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)

    const now = new Date()
    const defaultStart = new Date(now)
    defaultStart.setDate(defaultStart.getDate() - 29)

    const startDate = parseDate(query.startDate as string | undefined, defaultStart)
    startDate.setHours(0, 0, 0, 0)

    const endDate = parseDate(query.endDate as string | undefined, now)
    endDate.setHours(23, 59, 59, 999)

    if (endDate < startDate) {
      throw createError({ statusCode: 400, message: 'endDate doit être >= startDate' })
    }

    const periodDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000)
    )

    const establishmentIds = parseIdsParam(query.establishmentId as string | undefined)

    const salesConditions = [
      eq(sales.tenantId, tenantId),
      gte(sales.saleDate, startDate),
      lt(sales.saleDate, endDate),
      eq(sales.status, 'completed'),
    ]
    if (establishmentIds) salesConditions.push(inArray(sales.establishmentId, establishmentIds))

    // 1. TOP SELLING (par CA TTC décroissant)
    const topRows = await db
      .select({
        productId: saleItems.productId,
        productName: sql<string>`MAX(${saleItems.productName})`,
        quantity: sql<number>`CAST(COALESCE(SUM(${saleItems.quantity}), 0) AS INTEGER)`,
        totalTTC: sql<string>`COALESCE(SUM(CAST(${saleItems.totalTTC} AS NUMERIC)), 0)`,
        totalHT: sql<string>`COALESCE(SUM(CAST(${saleItems.totalHT} AS NUMERIC)), 0)`,
        costCovered: sql<string>`COALESCE(SUM(CASE WHEN ${saleItems.purchasePriceAtSale} IS NOT NULL THEN CAST(${saleItems.purchasePriceAtSale} AS NUMERIC) * ${saleItems.quantity} ELSE 0 END), 0)`,
        htCovered: sql<string>`COALESCE(SUM(CASE WHEN ${saleItems.purchasePriceAtSale} IS NOT NULL THEN CAST(${saleItems.totalHT} AS NUMERIC) ELSE 0 END), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(...salesConditions))
      .groupBy(saleItems.productId)
      .orderBy(desc(sql`SUM(CAST(${saleItems.totalTTC} AS NUMERIC))`))
      .limit(TOP_LIMIT)

    // 2. PRODUITS DORMANTS — IDs des produits VENDUS sur la période
    const soldIdsRows = await db
      .select({ productId: saleItems.productId })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(...salesConditions))
      .groupBy(saleItems.productId)

    const soldProductIds = soldIdsRows.map(r => r.productId)

    const dormantConditions = [
      eq(products.tenantId, tenantId),
      eq(products.isArchived, false),
    ]
    if (soldProductIds.length > 0) {
      dormantConditions.push(notInArray(products.id, soldProductIds))
    }

    const dormantRows = await db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        purchasePrice: products.purchasePrice,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(and(...dormantConditions))
      .orderBy(asc(products.updatedAt))
      .limit(DORMANT_LIMIT)

    // 3. ROTATION — jours d'écoulement = stock / (qty / periodDays)
    // Stock sommé sur les establishmentIds filtrés (ou tous du tenant)
    const stockConditions = [eq(productStocks.tenantId, tenantId)]
    if (establishmentIds) {
      stockConditions.push(inArray(productStocks.establishmentId, establishmentIds))
    }

    const stockRows = soldProductIds.length === 0
      ? []
      : await db
          .select({
            productId: productStocks.productId,
            stock: sql<number>`CAST(COALESCE(SUM(${productStocks.stock}), 0) AS INTEGER)`,
          })
          .from(productStocks)
          .where(and(...stockConditions, inArray(productStocks.productId, soldProductIds)))
          .groupBy(productStocks.productId)

    const stockByProduct = new Map(stockRows.map(r => [r.productId, r.stock]))

    // On reprend les ventes par produit (toutes, pas juste le top 20) pour la rotation
    const allSoldRows = await db
      .select({
        productId: saleItems.productId,
        productName: sql<string>`MAX(${saleItems.productName})`,
        quantity: sql<number>`CAST(COALESCE(SUM(${saleItems.quantity}), 0) AS INTEGER)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(...salesConditions))
      .groupBy(saleItems.productId)

    const rotation = allSoldRows
      .map(r => {
        const stock = stockByProduct.get(r.productId) ?? 0
        const velocityPerDay = r.quantity / periodDays
        const daysToSellout = velocityPerDay > 0 ? stock / velocityPerDay : null
        return {
          productId: r.productId,
          productName: r.productName,
          quantitySold: r.quantity,
          currentStock: stock,
          velocityPerDay: Number(velocityPerDay.toFixed(2)),
          daysToSellout: daysToSellout === null ? null : Number(daysToSellout.toFixed(1)),
        }
      })
      .filter(r => r.currentStock > 0 && r.daysToSellout !== null)
      .sort((a, b) => (b.daysToSellout ?? 0) - (a.daysToSellout ?? 0))
      .slice(0, ROTATION_LIMIT)

    const topSelling = topRows.map(r => {
      const htCov = Number(r.htCovered)
      const costCov = Number(r.costCovered)
      const margin = htCov - costCov
      return {
        productId: r.productId,
        productName: r.productName,
        quantity: r.quantity,
        totalTTC: Number(r.totalTTC),
        totalHT: Number(r.totalHT),
        totalMargin: Number(margin.toFixed(2)),
        marginPct: htCov > 0 ? Number(((margin / htCov) * 100).toFixed(2)) : null,
      }
    })

    const dormant = dormantRows.map(r => ({
      productId: r.id,
      productName: r.name,
      price: r.price ? Number(r.price) : 0,
      purchasePrice: r.purchasePrice ? Number(r.purchasePrice) : null,
      lastUpdate: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    }))

    return {
      success: true,
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        days: periodDays,
      },
      topSelling,
      dormant,
      rotation,
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    logger.error({ err: error }, 'Erreur lors du calcul des statistiques produits')
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
