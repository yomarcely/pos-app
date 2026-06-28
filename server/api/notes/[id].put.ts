import { db } from '~/server/database/connection'
import { notes } from '~/server/database/schema'
import { and, eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateNoteSchema, type UpdateNoteInput } from '~/server/validators/note.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Mettre à jour une note / un rappel
 * ==========================================
 *
 * PUT /api/notes/:id
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = parseInt(getRouterParam(event, 'id') || '0')

    if (!id) {
      throw createError({ statusCode: 400, message: 'ID de note invalide' })
    }

    const body = await validateBody<UpdateNoteInput>(event, updateNoteSchema)

    // Vérifier l'existence + scope tenant
    const [existing] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.tenantId, tenantId)))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, message: 'Note non trouvée' })
    }

    const updateData: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() }
    if (body.content !== undefined) updateData.content = body.content
    if (body.type !== undefined) updateData.type = body.type
    if (body.done !== undefined) updateData.done = body.done
    if (body.customerId !== undefined) updateData.customerId = body.customerId ?? null
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null

    const [updated] = await db
      .update(notes)
      .set(updateData)
      .where(and(eq(notes.id, id), eq(notes.tenantId, tenantId)))
      .returning()

    return { success: true, note: updated, message: 'Note mise à jour' }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour de la note')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
