import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Récupérer un établissement par ID
 * ==========================================
 *
 * GET /api/establishments/:id
 *
 * Retourne les détails d'un établissement spécifique
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID d\'établissement invalide',
      })
    }

    // Récupérer l'établissement
    const [establishment] = await db
      .select()
      .from(establishments)
      .where(
        and(
          eq(establishments.id, id),
          eq(establishments.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!establishment) {
      throw createError({
        statusCode: 404,
        message: 'Établissement introuvable',
      })
    }

    return {
      success: true,
      establishment,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'établissement:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
