import { db } from '~/server/database/connection'
import {
  inventoryPreparations,
  inventoryPreparationItems,
  establishments,
} from '~/server/database/schema'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * GET /api/inventory-preparations
 *
 * Query params (optionnels):
 * - status : 'draft' | 'validated'
 * - establishmentId : number
 * - limit : nombre max (défaut 100, max 500)
 *
 * Renvoie chaque préparation avec un compteur d'items (pas le détail —
 * voir /api/inventory-preparations/:id pour les lignes).
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)

    const status = typeof query.status === 'string' ? query.status : undefined
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined
    const rawLimit = query.limit ? Number(query.limit) : 100
    const limit = Math.min(Math.max(rawLimit, 1), 500)

    const conditions = [eq(inventoryPreparations.tenantId, tenantId)]
    if (status === 'draft' || status === 'validated') {
      conditions.push(eq(inventoryPreparations.status, status))
    }
    if (establishmentId) {
      conditions.push(eq(inventoryPreparations.establishmentId, establishmentId))
    }

    const preparations = await db
      .select({
        id: inventoryPreparations.id,
        preparationNumber: inventoryPreparations.preparationNumber,
        name: inventoryPreparations.name,
        comment: inventoryPreparations.comment,
        establishmentId: inventoryPreparations.establishmentId,
        establishmentName: establishments.name,
        status: inventoryPreparations.status,
        validatedAt: inventoryPreparations.validatedAt,
        validatedMovementId: inventoryPreparations.validatedMovementId,
        createdAt: inventoryPreparations.createdAt,
        updatedAt: inventoryPreparations.updatedAt,
      })
      .from(inventoryPreparations)
      .leftJoin(
        establishments,
        eq(inventoryPreparations.establishmentId, establishments.id),
      )
      .where(and(...conditions))
      .orderBy(desc(inventoryPreparations.createdAt))
      .limit(limit)

    // Compteur d'items par préparation
    let countsByPrepId = new Map<number, number>()
    if (preparations.length > 0) {
      const counts = await db
        .select({
          preparationId: inventoryPreparationItems.preparationId,
          itemCount: sql<number>`count(*)::int`,
        })
        .from(inventoryPreparationItems)
        .where(
          and(
            eq(inventoryPreparationItems.tenantId, tenantId),
            inArray(
              inventoryPreparationItems.preparationId,
              preparations.map((p) => p.id),
            ),
          ),
        )
        .groupBy(inventoryPreparationItems.preparationId)
      countsByPrepId = new Map(counts.map((c) => [c.preparationId, c.itemCount]))
    }

    const formatted = preparations.map((p) => ({
      ...p,
      itemCount: countsByPrepId.get(p.id) || 0,
    }))

    return { success: true, preparations: formatted, count: formatted.length }
  } catch (error) {
    logger.error({ err: error }, "Erreur lors de la récupération des préparations d'inventaire")
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
