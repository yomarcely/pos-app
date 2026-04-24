import { db } from '~/server/database/connection'
import { pendingSales, establishments } from '~/server/database/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Lister les tickets en attente
 * ==========================================
 *
 * GET /api/pending-sales?registerId=X&establishmentId=Y
 *
 * - Par défaut, retourne uniquement les tickets de la caisse (registerId).
 * - Si l'établissement a sharePendingSales=true, retourne tous les tickets
 *   de l'établissement (toutes caisses confondues).
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)

    const registerId = Number(query.registerId)
    const establishmentId = Number(query.establishmentId)

    if (!registerId || !establishmentId) {
      throw createError({
        statusCode: 400,
        message: 'registerId et establishmentId sont requis',
      })
    }

    // Charger le flag sharePendingSales de l'établissement
    const [establishment] = await db
      .select({ sharePendingSales: establishments.sharePendingSales })
      .from(establishments)
      .where(
        and(
          eq(establishments.id, establishmentId),
          eq(establishments.tenantId, tenantId),
        )
      )
      .limit(1)

    if (!establishment) {
      throw createError({ statusCode: 404, message: 'Établissement introuvable' })
    }

    const whereClause = establishment.sharePendingSales
      ? and(
          eq(pendingSales.tenantId, tenantId),
          eq(pendingSales.establishmentId, establishmentId),
        )
      : and(
          eq(pendingSales.tenantId, tenantId),
          eq(pendingSales.establishmentId, establishmentId),
          eq(pendingSales.registerId, registerId),
        )

    const rows = await db
      .select()
      .from(pendingSales)
      .where(whereClause)
      .orderBy(desc(pendingSales.createdAt))

    return {
      success: true,
      shared: establishment.sharePendingSales,
      pendingSales: rows,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des tickets en attente')
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
