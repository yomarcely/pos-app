import { and, asc, eq, gte, lte, inArray } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { sales, saleItems, establishments } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { buildFecContent, buildFecFilename, type FecSale } from '~/utils/fecExport'

/**
 * GET /api/reports/fec?from=YYYY-MM-DD&to=YYYY-MM-DD&establishmentId=X
 *
 * Génère le Fichier des Écritures Comptables (FEC) pour la période demandée.
 * Format DGFiP (Article A47 A-1 du LPF). Servi en attachement text/plain UTF-8.
 *
 * Filtres :
 * - from/to (obligatoires) : bornes de saleDate (inclusive)
 * - establishmentId (optionnel) : restreint à un seul établissement
 *
 * Seules les ventes status='completed' sont incluses (les annulations seraient
 * gérées via écritures de contre-passation — non supporté en V1).
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const query = getQuery(event)
    const fromStr = query.from as string | undefined
    const toStr = query.to as string | undefined
    const establishmentIdParam = query.establishmentId as string | undefined

    if (!fromStr || !toStr) {
      throw createError({
        statusCode: 400,
        message: 'Paramètres "from" et "to" requis (format YYYY-MM-DD)',
      })
    }

    const from = new Date(fromStr)
    const to = new Date(toStr)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw createError({ statusCode: 400, message: 'Dates invalides (attendu YYYY-MM-DD)' })
    }
    // `to` borne inclusive de fin de journée
    to.setHours(23, 59, 59, 999)

    const conditions = [
      eq(sales.tenantId, tenantId),
      eq(sales.status, 'completed'),
      gte(sales.saleDate, from),
      lte(sales.saleDate, to),
    ]
    if (establishmentIdParam) {
      conditions.push(eq(sales.establishmentId, Number(establishmentIdParam)))
    }

    // 1. Charger les ventes triées chronologiquement (requis FEC)
    const salesRows = await db
      .select({
        id: sales.id,
        ticketNumber: sales.ticketNumber,
        saleDate: sales.saleDate,
        totalHT: sales.totalHT,
        totalTVA: sales.totalTVA,
        totalTTC: sales.totalTTC,
        payments: sales.payments,
      })
      .from(sales)
      .where(and(...conditions))
      .orderBy(asc(sales.saleDate), asc(sales.id))

    // 2. Charger en bulk tous les saleItems liés (1 SELECT, pas de N+1)
    const saleIds = salesRows.map(s => s.id)
    const itemsRows = saleIds.length > 0
      ? await db
          .select({
            saleId: saleItems.saleId,
            totalHT: saleItems.totalHT,
            totalTTC: saleItems.totalTTC,
            tvaRate: saleItems.tvaRate,
          })
          .from(saleItems)
          .where(
            and(
              eq(saleItems.tenantId, tenantId),
              inArray(saleItems.saleId, saleIds),
            ),
          )
      : []

    // Indexer items par saleId
    const itemsBySale = new Map<number, typeof itemsRows>()
    for (const it of itemsRows) {
      const list = itemsBySale.get(it.saleId) ?? []
      list.push(it)
      itemsBySale.set(it.saleId, list)
    }

    // 3. Composer les FecSale
    const fecSales: FecSale[] = salesRows.map(s => ({
      ticketNumber: s.ticketNumber,
      saleDate: s.saleDate,
      totalHT: parseFloat(s.totalHT),
      totalTVA: parseFloat(s.totalTVA),
      totalTTC: parseFloat(s.totalTTC),
      payments: Array.isArray(s.payments)
        ? (s.payments as Array<{ mode: string, amount: number }>).map(p => ({
            mode: String(p.mode),
            amount: Number(p.amount),
          }))
        : [],
      items: (itemsBySale.get(s.id) ?? []).map(it => ({
        totalHT: parseFloat(it.totalHT),
        totalTTC: parseFloat(it.totalTTC),
        tvaRate: parseFloat(it.tvaRate),
      })),
    }))

    // 4. Récupérer le SIREN pour le nom de fichier (du 1er établissement du tenant)
    let siren: string | null = null
    if (establishmentIdParam) {
      const [estab] = await db
        .select({ siret: establishments.siret })
        .from(establishments)
        .where(and(eq(establishments.id, Number(establishmentIdParam)), eq(establishments.tenantId, tenantId)))
        .limit(1)
      siren = estab?.siret ?? null
    }
    if (!siren) {
      const [estab] = await db
        .select({ siret: establishments.siret })
        .from(establishments)
        .where(eq(establishments.tenantId, tenantId))
        .limit(1)
      siren = estab?.siret ?? null
    }

    // 5. Générer le contenu FEC
    const content = buildFecContent(fecSales)
    const filename = buildFecFilename(siren, to)

    logger.info({ tenantId, salesCount: fecSales.length, period: { from: fromStr, to: toStr } }, 'FEC généré')

    // 6. Retourner en attachement (utiliser setHeader pour text/plain + Content-Disposition)
    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
    return content
  }
  catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error
    logger.error({ err: error }, 'Erreur génération FEC')
    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
