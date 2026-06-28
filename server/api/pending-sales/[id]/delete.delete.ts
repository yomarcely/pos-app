import { db } from '~/server/database/connection'
import { pendingSales } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Supprimer un ticket en attente
 * ==========================================
 *
 * DELETE /api/pending-sales/:id/delete
 *
 * Supprime un ticket en attente (à la reprise ou abandon).
 * Pas d'audit log NF525 — ce n'est pas une vente.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID invalide' })
    }

    const [deleted] = await db
      .delete(pendingSales)
      .where(
        and(
          eq(pendingSales.id, id),
          eq(pendingSales.tenantId, tenantId),
        )
      )
      .returning()

    if (!deleted) {
      throw createError({ statusCode: 404, message: 'Ticket en attente introuvable' })
    }

    return { success: true }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression du ticket en attente')
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
