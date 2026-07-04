import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { findLastUnclosedBusinessDay } from '~/server/utils/closureGuard'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Dernière journée active non clôturée
 * ==========================================
 *
 * GET /api/sales/unclosed-day?registerId=1
 *
 * Renvoie le dernier jour métier (avant aujourd'hui) avec de l'activité mais
 * sans clôture pour cette caisse, ou null si tout est en ordre. Utilisé par la
 * caisse (message bloquant) et la synthèse (préremplissage de la date).
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const registerId = Number(query.registerId)

    if (!Number.isInteger(registerId) || registerId <= 0) {
      throw createError({ statusCode: 400, message: 'registerId requis' })
    }

    const day = await findLastUnclosedBusinessDay(tenantId, registerId)

    return { success: true, day }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }
    logger.error({ err: error }, 'Erreur lors de la recherche de journée non clôturée')
    throw createError({ statusCode: 500, message: "Une erreur interne s'est produite" })
  }
})
