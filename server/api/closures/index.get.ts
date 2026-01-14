import { db } from '~/server/database/connection'
import { closures, registers, establishments } from '~/server/database/schema'
import { desc, gte, lte, and, eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer la liste des clôtures
 * ==========================================
 *
 * GET /api/closures?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&registerId=1&establishmentId=1
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const startDate = query.startDate as string | undefined
    const endDate = query.endDate as string | undefined
    const registerIdParam = query.registerId as string | undefined
    const establishmentIdParam = query.establishmentId as string | undefined

    // Construire les conditions de filtrage
    const conditions = [eq(closures.tenantId, tenantId)]

    if (startDate) {
      conditions.push(gte(closures.closureDate, startDate))
    }

    if (endDate) {
      conditions.push(lte(closures.closureDate, endDate))
    }

    if (registerIdParam) {
      conditions.push(eq(closures.registerId, Number(registerIdParam)))
    }

    if (establishmentIdParam) {
      conditions.push(eq(closures.establishmentId, Number(establishmentIdParam)))
    }

    // Récupérer les clôtures avec filtrage et jointures pour obtenir les infos de caisse et établissement
    const closuresList = await db
      .select({
        id: closures.id,
        closureDate: closures.closureDate,
        ticketCount: closures.ticketCount,
        cancelledCount: closures.cancelledCount,
        totalHT: closures.totalHT,
        totalTVA: closures.totalTVA,
        totalTTC: closures.totalTTC,
        paymentMethods: closures.paymentMethods,
        closureHash: closures.closureHash,
        firstTicketNumber: closures.firstTicketNumber,
        lastTicketNumber: closures.lastTicketNumber,
        lastTicketHash: closures.lastTicketHash,
        closedBy: closures.closedBy,
        closedById: closures.closedById,
        createdAt: closures.createdAt,
        registerId: closures.registerId,
        establishmentId: closures.establishmentId,
        registerName: registers.name,
        establishmentName: establishments.name,
      })
      .from(closures)
      .leftJoin(registers, eq(closures.registerId, registers.id))
      .leftJoin(establishments, eq(closures.establishmentId, establishments.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(closures.closureDate))

    logger.info({ count: closuresList.length }, 'Clôtures récupérées')

    return {
      success: true,
      closures: closuresList,
      count: closuresList.length,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des clôtures')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
