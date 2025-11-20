import { db } from '~/server/database/connection'
import { closures } from '~/server/database/schema'
import { desc } from 'drizzle-orm'

/**
 * ==========================================
 * API: Récupérer la liste des clôtures
 * ==========================================
 *
 * GET /api/sales/closures?limit=50
 *
 * Récupère l'historique des clôtures journalières
 */

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const limit = query.limit ? Number(query.limit) : 50

    // Récupérer les clôtures par ordre décroissant (plus récentes en premier)
    const closuresList = await db
      .select()
      .from(closures)
      .orderBy(desc(closures.closureDate))
      .limit(limit)

    // Formater les données
    const formattedClosures = closuresList.map(closure => ({
      id: closure.id,
      date: closure.closureDate,
      ticketCount: closure.ticketCount,
      cancelledCount: closure.cancelledCount,
      totalHT: Number(closure.totalHT),
      totalTVA: Number(closure.totalTVA),
      totalTTC: Number(closure.totalTTC),
      paymentMethods: closure.paymentMethods,
      closureHash: closure.closureHash,
      firstTicketNumber: closure.firstTicketNumber,
      lastTicketNumber: closure.lastTicketNumber,
      lastTicketHash: closure.lastTicketHash,
      closedBy: closure.closedBy,
      closedById: closure.closedById,
      closedAt: closure.createdAt,
    }))

    return {
      success: true,
      closures: formattedClosures,
      count: formattedClosures.length,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des clôtures:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
