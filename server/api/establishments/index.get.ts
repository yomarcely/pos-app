import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer tous les établissements
 * ==========================================
 *
 * GET /api/establishments
 * GET /api/establishments?includeInactive=true
 *
 * Retourne la liste des établissements pour le tenant.
 * Par défaut, seuls les établissements actifs sont retournés.
 * Passer includeInactive=true pour inclure les inactifs (page de gestion).
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const includeInactive = query.includeInactive === 'true'

    // Récupérer les établissements (actifs uniquement par défaut)
    const allEstablishments = await db
      .select()
      .from(establishments)
      .where(
        includeInactive
          ? eq(establishments.tenantId, tenantId)
          : and(
              eq(establishments.tenantId, tenantId),
              eq(establishments.isActive, true)
            )
      )
      .orderBy(establishments.name)

    return {
      success: true,
      establishments: allEstablishments,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des établissements')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
