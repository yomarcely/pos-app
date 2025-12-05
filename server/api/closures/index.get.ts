import { db } from '~/server/database/connection'
import { closures } from '~/server/database/schema'
import { desc, gte, lte, and, eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Récupérer la liste des clôtures
 * ==========================================
 *
 * GET /api/closures?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const startDate = query.startDate as string | undefined
    const endDate = query.endDate as string | undefined

    // Construire les conditions de filtrage
    const conditions = [eq(closures.tenantId, tenantId)]

    if (startDate) {
      conditions.push(gte(closures.closureDate, startDate))
    }

    if (endDate) {
      conditions.push(lte(closures.closureDate, endDate))
    }

    // Récupérer les clôtures avec filtrage
    const closuresList = await db
      .select()
      .from(closures)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(closures.closureDate))

    console.log(`📊 ${closuresList.length} clôture(s) récupérée(s)`)

    return {
      success: true,
      closures: closuresList,
      count: closuresList.length,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des clôtures:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
