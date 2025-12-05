import { db } from '~/server/database/connection'
import { closures } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Vérifier si une journée est clôturée
 * ==========================================
 *
 * GET /api/sales/check-closure?date=YYYY-MM-DD
 *
 * Vérifie si une journée donnée a été clôturée
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const dateParam = query.date as string

    const targetDate = dateParam || new Date().toISOString().split('T')[0]

    // Chercher une clôture pour cette journée
    const [closure] = await db
      .select()
      .from(closures)
      .where(
        and(
          eq(closures.tenantId, tenantId),
          eq(closures.closureDate, targetDate)
        )
      )
      .limit(1)

    return {
      success: true,
      isClosed: !!closure,
      date: targetDate,
      closure: closure || null,
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de clôture:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
