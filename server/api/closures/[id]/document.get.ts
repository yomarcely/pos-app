import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { closures, sales, saleItems, registers, establishments } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * GET /api/closures/:id/document
 *
 * Retourne toutes les données nécessaires à l'impression du ticket Z d'une clôture :
 * - clôture (totaux, modes de paiement, hashes NF525, premier/dernier ticket)
 * - détail TVA agrégé par taux (calculé à la volée depuis sale_items)
 * - infos établissement (entête + mentions légales)
 * - infos caisse
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = parseInt(getRouterParam(event, 'id') || '0', 10)
    if (!id) {
      throw createError({ statusCode: 400, message: 'ID de clôture invalide' })
    }

    // 1. Charger la clôture + caisse + établissement (jointure simple)
    const [row] = await db
      .select({
        closure: closures,
        register: registers,
        establishment: establishments,
      })
      .from(closures)
      .leftJoin(registers, eq(closures.registerId, registers.id))
      .leftJoin(establishments, eq(closures.establishmentId, establishments.id))
      .where(and(eq(closures.id, id), eq(closures.tenantId, tenantId)))
      .limit(1)

    if (!row || !row.closure) {
      throw createError({ statusCode: 404, message: 'Clôture non trouvée' })
    }

    const closure = row.closure

    // 2. Agréger TVA par taux : SUM(totalHT) et SUM(totalTTC - totalHT) groupés par tva_rate
    //    Sur les sale_items des ventes liées à cette clôture (status='completed').
    const tvaBreakdownRows = await db
      .select({
        tvaRate: saleItems.tvaRate,
        baseHT: sql<string>`COALESCE(SUM(CAST(${saleItems.totalHT} AS NUMERIC)), 0)`,
        montantTVA: sql<string>`COALESCE(SUM(CAST(${saleItems.totalTTC} AS NUMERIC) - CAST(${saleItems.totalHT} AS NUMERIC)), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(
        and(
          eq(saleItems.tenantId, tenantId),
          eq(sales.closureId, closure.id),
          eq(sales.status, 'completed'),
        ),
      )
      .groupBy(saleItems.tvaRate)
      .orderBy(saleItems.tvaRate)

    const tvaBreakdown = tvaBreakdownRows.map(r => ({
      rate: parseFloat(r.tvaRate),
      baseHT: parseFloat(r.baseHT),
      montantTVA: parseFloat(r.montantTVA),
    }))

    return {
      success: true,
      closure: {
        id: closure.id,
        closureDate: closure.closureDate,
        ticketCount: closure.ticketCount,
        cancelledCount: closure.cancelledCount,
        totalHT: parseFloat(closure.totalHT),
        totalTVA: parseFloat(closure.totalTVA),
        totalTTC: parseFloat(closure.totalTTC),
        paymentMethods: closure.paymentMethods as Record<string, number>,
        closureHash: closure.closureHash,
        firstTicketNumber: closure.firstTicketNumber,
        lastTicketNumber: closure.lastTicketNumber,
        lastTicketHash: closure.lastTicketHash,
        closedBy: closure.closedBy,
        createdAt: closure.createdAt,
      },
      register: row.register
        ? { id: row.register.id, name: row.register.name }
        : null,
      establishment: row.establishment
        ? {
            id: row.establishment.id,
            name: row.establishment.name,
            address: row.establishment.address,
            postalCode: row.establishment.postalCode,
            city: row.establishment.city,
            phone: row.establishment.phone,
            email: row.establishment.email,
            siret: row.establishment.siret,
            naf: row.establishment.naf,
            tvaNumber: row.establishment.tvaNumber,
          }
        : null,
      tvaBreakdown,
    }
  }
  catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error
    logger.error({ err: error }, 'Erreur récupération document de clôture')
    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
