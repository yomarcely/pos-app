import { db } from '~/server/database/connection'
import { sales, saleItems } from '~/server/database/schema'
import { and, eq, gte, lt, inArray, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { computeMarginKpis, densifyHourlySeries, parseIdsParam } from '~/server/utils/revenueStats'

/**
 * GET /api/stats/revenue
 *
 * Statistiques de chiffre d'affaires sur une période, multi-établissements.
 *
 * Query params :
 *   - startDate : YYYY-MM-DD (inclusif)
 *   - endDate   : YYYY-MM-DD (inclusif, transformé en fin de journée)
 *   - establishmentId? : single id ou CSV "1,2,3" (vide = tous établ. du tenant)
 *   - registerId? : single id (optionnel)
 *
 * Renvoie KPIs + séries quotidienne et horaire, calculées via agrégations SQL.
 * Seules les ventes status='completed' sont comptabilisées.
 *
 * Marge : basée sur saleItems.purchasePriceAtSale (snapshot à la vente).
 * Les ventes pré-migration ont purchasePriceAtSale=NULL → exclues du calcul
 * marge. marginCoveragePct indique la fraction du CA HT couverte par snapshot.
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

    // 30 derniers jours par défaut
    const now = new Date()
    const defaultStart = new Date(now)
    defaultStart.setDate(defaultStart.getDate() - 29)

    const startDate = parseDate(query.startDate as string | undefined, defaultStart)
    startDate.setHours(0, 0, 0, 0)

    const endDate = parseDate(query.endDate as string | undefined, now)
    endDate.setHours(23, 59, 59, 999)

    if (endDate < startDate) {
      throw createError({
        statusCode: 400,
        message: 'endDate doit être >= startDate',
      })
    }

    const establishmentIds = parseIdsParam(query.establishmentId as string | undefined)
    const registerIds = parseIdsParam(query.registerId as string | undefined)

    const baseConditions = [
      eq(sales.tenantId, tenantId),
      gte(sales.saleDate, startDate),
      lt(sales.saleDate, endDate),
      eq(sales.status, 'completed'),
    ]
    if (establishmentIds) {
      baseConditions.push(inArray(sales.establishmentId, establishmentIds))
    }
    if (registerIds) {
      baseConditions.push(inArray(sales.registerId, registerIds))
    }

    // 1. KPIs ventes (depuis sales)
    const [salesKpis] = await db
      .select({
        totalTTC: sql<string>`COALESCE(SUM(CAST(${sales.totalTTC} AS NUMERIC)), 0)`,
        totalHT: sql<string>`COALESCE(SUM(CAST(${sales.totalHT} AS NUMERIC)), 0)`,
        totalTVA: sql<string>`COALESCE(SUM(CAST(${sales.totalTVA} AS NUMERIC)), 0)`,
        ticketCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(sales)
      .where(and(...baseConditions))

    // 2. KPIs items + marge (depuis saleItems join sales)
    // - totalQuantity : qté totale vendue
    // - totalCostCovered : Σ(quantity * purchasePriceAtSale) sur items snapshotés
    // - totalHTCovered : Σ(totalHT) sur items snapshotés (revenu couvert par snapshot)
    // - totalHTAll : Σ(totalHT) sur tous les items (pour marginCoveragePct)
    const [itemsKpis] = await db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)`,
        totalCostCovered: sql<string>`COALESCE(SUM(CASE WHEN ${saleItems.purchasePriceAtSale} IS NOT NULL THEN CAST(${saleItems.purchasePriceAtSale} AS NUMERIC) * ${saleItems.quantity} ELSE 0 END), 0)`,
        totalHTCovered: sql<string>`COALESCE(SUM(CASE WHEN ${saleItems.purchasePriceAtSale} IS NOT NULL THEN CAST(${saleItems.totalHT} AS NUMERIC) ELSE 0 END), 0)`,
        totalHTAll: sql<string>`COALESCE(SUM(CAST(${saleItems.totalHT} AS NUMERIC)), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(...baseConditions))

    // 3. Série quotidienne (CA TTC + nb tickets par jour)
    const dailyRows = await db
      .select({
        day: sql<string>`TO_CHAR(${sales.saleDate}, 'YYYY-MM-DD')`,
        ttc: sql<string>`COALESCE(SUM(CAST(${sales.totalTTC} AS NUMERIC)), 0)`,
        ticketCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(sales)
      .where(and(...baseConditions))
      .groupBy(sql`TO_CHAR(${sales.saleDate}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${sales.saleDate}, 'YYYY-MM-DD')`)

    // 4. Série horaire (nb tickets + CA par tranche horaire 0..23, agrégé sur la période)
    const hourlyRows = await db
      .select({
        hour: sql<number>`CAST(EXTRACT(HOUR FROM ${sales.saleDate}) AS INTEGER)`,
        ttc: sql<string>`COALESCE(SUM(CAST(${sales.totalTTC} AS NUMERIC)), 0)`,
        ticketCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(sales)
      .where(and(...baseConditions))
      .groupBy(sql`EXTRACT(HOUR FROM ${sales.saleDate})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${sales.saleDate})`)

    if (!salesKpis || !itemsKpis) {
      throw createError({ statusCode: 500, message: 'Erreur d\'agrégation des statistiques' })
    }

    const totalTTC = Number(salesKpis.totalTTC)
    const totalHT = Number(salesKpis.totalHT)
    const totalTVA = Number(salesKpis.totalTVA)
    const ticketCount = salesKpis.ticketCount
    const totalQuantity = itemsKpis.totalQuantity
    const totalCostCovered = Number(itemsKpis.totalCostCovered)
    const totalHTCovered = Number(itemsKpis.totalHTCovered)
    const totalHTAll = Number(itemsKpis.totalHTAll)

    const margin = computeMarginKpis(totalCostCovered, totalHTCovered, totalHTAll)

    const avgBasketValue = ticketCount > 0 ? totalTTC / ticketCount : 0
    const avgBasketQuantity = ticketCount > 0 ? totalQuantity / ticketCount : 0

    const hourlySeries = densifyHourlySeries(
      hourlyRows.map(r => ({
        hour: r.hour,
        ttc: Number(r.ttc),
        ticketCount: r.ticketCount,
      }))
    )

    return {
      success: true,
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      },
      filters: {
        establishmentIds,
        registerIds,
      },
      kpis: {
        totalTTC,
        totalHT,
        totalTVA,
        ticketCount,
        totalQuantity,
        avgBasketValue: Number(avgBasketValue.toFixed(2)),
        avgBasketQuantity: Number(avgBasketQuantity.toFixed(2)),
        totalCost: margin.totalCost,
        totalMargin: margin.totalMargin,
        marginPct: margin.marginPct,
        marginCoveragePct: margin.marginCoveragePct,
      },
      dailySeries: dailyRows.map(r => ({
        date: r.day,
        ttc: Number(r.ttc),
        ticketCount: r.ticketCount,
      })),
      hourlySeries,
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    logger.error({ err: error }, 'Erreur lors du calcul des statistiques de revenu')
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
