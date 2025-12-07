import { db } from '~/server/database/connection'
import { closures } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Vérifier si une journée est clôturée
 * ==========================================
 *
 * GET /api/sales/check-closure?date=YYYY-MM-DD&registerId=1
 *
 * Vérifie si une journée donnée a été clôturée pour une caisse spécifique
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const dateParam = query.date as string
    const registerIdParam = query.registerId as string

    const targetDate = dateParam || new Date().toISOString().split('T')[0]
    const registerId = registerIdParam ? Number(registerIdParam) : null

    // Construction des conditions WHERE dynamiques
    const conditions = [
      eq(closures.tenantId, tenantId),
      eq(closures.closureDate, targetDate),
    ]

    if (registerId) {
      conditions.push(eq(closures.registerId, registerId))
    }

    // Chercher une clôture pour cette journée et cette caisse
    const [closure] = await db
      .select()
      .from(closures)
      .where(and(...conditions))
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
