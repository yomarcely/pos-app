import { db } from '~/server/database/connection'
import { notes } from '~/server/database/schema'
import { and, eq, or, isNull, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Lister les notes / rappels
 * ==========================================
 *
 * GET /api/notes?establishmentId=...&done=true|false
 *
 * Retourne les notes du tenant. Si establishmentId est fourni, renvoie les
 * notes rattachées à cet établissement ET les notes globales (establishmentId NULL).
 * Tri : à faire d'abord, puis par date limite (les sans-date en dernier), puis récentes.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined
    const doneFilter = query.done === 'true' ? true : query.done === 'false' ? false : undefined

    const conditions = [eq(notes.tenantId, tenantId)]

    if (establishmentId) {
      const scope = or(eq(notes.establishmentId, establishmentId), isNull(notes.establishmentId))
      if (scope) conditions.push(scope)
    }

    if (doneFilter !== undefined) {
      conditions.push(eq(notes.done, doneFilter))
    }

    const rows = await db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(
        sql`${notes.done} ASC`,
        sql`${notes.dueDate} ASC NULLS LAST`,
        sql`${notes.createdAt} DESC`,
      )

    return { success: true, notes: rows }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des notes')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
