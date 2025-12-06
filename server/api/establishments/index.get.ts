import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Récupérer tous les établissements
 * ==========================================
 *
 * GET /api/establishments
 *
 * Retourne la liste de tous les établissements actifs pour le tenant
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    // Récupérer tous les établissements actifs
    const allEstablishments = await db
      .select()
      .from(establishments)
      .where(
        and(
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
    console.error('Erreur lors de la récupération des établissements:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
