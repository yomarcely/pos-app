import { db } from '~/server/database/connection'
import { notes } from '~/server/database/schema'
import { and, eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Supprimer une note / un rappel
 * ==========================================
 *
 * DELETE /api/notes/:id
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = parseInt(getRouterParam(event, 'id') || '0')

    if (!id) {
      throw createError({ statusCode: 400, message: 'ID de note invalide' })
    }

    const [deleted] = await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.tenantId, tenantId)))
      .returning({ id: notes.id })

    if (!deleted) {
      throw createError({ statusCode: 404, message: 'Note non trouvée' })
    }

    return { success: true, message: 'Note supprimée' }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression de la note')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
