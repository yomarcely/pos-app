import { db } from '~/server/database/connection'
import { notes } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createNoteSchema, type CreateNoteInput } from '~/server/validators/note.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Créer une note / un rappel
 * ==========================================
 *
 * POST /api/notes
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await validateBody<CreateNoteInput>(event, createNoteSchema)

    const [created] = await db
      .insert(notes)
      .values({
        tenantId,
        content: body.content,
        type: body.type,
        customerId: body.customerId ?? null,
        establishmentId: body.establishmentId ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      })
      .returning()

    return { success: true, note: created, message: 'Note créée' }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la création de la note')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
