import { db } from '~/server/database/connection'
import { sales, saleItems, sellers } from '~/server/database/schema'
import { and, eq, gte, lt, inArray, sql, desc } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { parseIdsParam } from '~/server/utils/revenueStats'

/**
 * GET /api/stats/sellers
 *
 * Classement des vendeurs sur la période.
 *
 * Query params identiques à /api/stats/revenue : startDate, endDate,
 * establishmentId (CSV multi), registerId (CSV multi).
 *
 * Renvoie une ligne par vendeur ayant au moins 1 vente sur la période,
 * triée par CA TTC décroissant.
 */

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
    assertRole(event, 'manager')
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

    const establishmentIds = parseIdsParam(query.establishmentId as string | undefined)
    const registerIds = parseIdsParam(query.registerId as string | undefined)

    const baseConditions = [
      eq(sales.tenantId, tenantId),
      gte(sales.saleDate, startDate),
      lt(sales.saleDate, endDate),
      eq(sales.status, 'completed'),
    ]
    if (establishmentIds) baseConditions.push(inArray(sales.establishmentId, establishmentIds))
    if (registerIds) baseConditions.push(inArray(sales.registerId, registerIds))

    // Agrégation sales par vendeur (CA, tickets) + jointure sellers pour le nom
    const sellerRows = await db
      .select({
        sellerId: sales.sellerId,
        sellerName: sellers.name,
        ticketCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalTTC: sql<string>`COALESCE(SUM(CAST(${sales.totalTTC} AS NUMERIC)), 0)`,
        totalHT: sql<string>`COALESCE(SUM(CAST(${sales.totalHT} AS NUMERIC)), 0)`,
      })
      .from(sales)
      .leftJoin(sellers, eq(sellers.id, sales.sellerId))
      .where(and(...baseConditions))
      .groupBy(sales.sellerId, sellers.name)
      .orderBy(desc(sql`SUM(CAST(${sales.totalTTC} AS NUMERIC))`))

    // Agrégation marge par vendeur (saleItems join sales)
    const marginRows = await db
      .select({
        sellerId: sales.sellerId,
        totalQuantity: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)`,
        costCovered: sql<string>`COALESCE(SUM(CASE WHEN ${saleItems.purchasePriceAtSale} IS NOT NULL THEN CAST(${saleItems.purchasePriceAtSale} AS NUMERIC) * ${saleItems.quantity} ELSE 0 END), 0)`,
        htCovered: sql<string>`COALESCE(SUM(CASE WHEN ${saleItems.purchasePriceAtSale} IS NOT NULL THEN CAST(${saleItems.totalHT} AS NUMERIC) ELSE 0 END), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(...baseConditions))
      .groupBy(sales.sellerId)

    const marginById = new Map(
      marginRows.map(r => [r.sellerId, r])
    )

    const sellersStats = sellerRows.map(row => {
      const margin = marginById.get(row.sellerId)
      const ttc = Number(row.totalTTC)
      const ticketCount = row.ticketCount
      const costCovered = margin ? Number(margin.costCovered) : 0
      const htCovered = margin ? Number(margin.htCovered) : 0
      const totalMargin = htCovered - costCovered
      const marginPct = htCovered > 0 ? (totalMargin / htCovered) * 100 : null

      return {
        sellerId: row.sellerId,
        sellerName: row.sellerName ?? `Vendeur #${row.sellerId}`,
        ticketCount,
        totalTTC: ttc,
        totalHT: Number(row.totalHT),
        totalQuantity: margin?.totalQuantity ?? 0,
        avgBasketValue: ticketCount > 0 ? Number((ttc / ticketCount).toFixed(2)) : 0,
        totalMargin: Number(totalMargin.toFixed(2)),
        marginPct: marginPct === null ? null : Number(marginPct.toFixed(2)),
      }
    })

    return {
      success: true,
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      },
      sellers: sellersStats,
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    logger.error({ err: error }, 'Erreur lors du calcul des statistiques vendeurs')
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
