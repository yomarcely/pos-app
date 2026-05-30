import { db } from '~/server/database/connection'
import {
  movements,
  stockMovements,
  products,
  suppliers,
  establishments,
} from '~/server/database/schema'
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Historique des mouvements (table movements + lignes)
 * ==========================================
 *
 * GET /api/movements/history
 *
 * Query params (optionnels):
 * - dateFrom : ISO date (YYYY-MM-DD), inclusif
 * - dateTo   : ISO date (YYYY-MM-DD), inclusif (fin de journée)
 * - type     : 'reception' | 'reception-supplier' | 'reception-free' |
 *              'adjustment' | 'loss' | 'transfer'
 * - establishmentId : number
 * - limit    : nombre max de mouvements (défaut 100, max 500)
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)

    const dateFrom = typeof query.dateFrom === 'string' ? query.dateFrom : undefined
    const dateTo = typeof query.dateTo === 'string' ? query.dateTo : undefined
    const typeParam = typeof query.type === 'string' ? query.type : undefined
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined
    const rawLimit = query.limit ? Number(query.limit) : 100
    const limit = Math.min(Math.max(rawLimit, 1), 500)

    const conditions = [eq(movements.tenantId, tenantId)]

    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00.000Z`)
      if (!isNaN(from.getTime())) conditions.push(gte(movements.createdAt, from))
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999Z`)
      if (!isNaN(to.getTime())) conditions.push(lte(movements.createdAt, to))
    }

    // Type filter avec sous-types pour reception
    switch (typeParam) {
      case 'reception-supplier':
        conditions.push(eq(movements.type, 'reception'))
        conditions.push(isNotNull(movements.supplierId))
        break
      case 'reception-free':
        conditions.push(eq(movements.type, 'reception'))
        conditions.push(isNull(movements.supplierId))
        break
      case 'reception':
      case 'adjustment':
      case 'loss':
      case 'transfer':
        conditions.push(eq(movements.type, typeParam))
        break
      default:
        // 'all' ou non spécifié → aucun filtre type
        break
    }

    if (establishmentId) {
      conditions.push(eq(movements.establishmentId, establishmentId))
    }

    // 1. Mouvements + jointures fournisseur/établissement
    const rows = await db
      .select({
        id: movements.id,
        movementNumber: movements.movementNumber,
        type: movements.type,
        comment: movements.comment,
        supplierId: movements.supplierId,
        supplierName: suppliers.name,
        deliveryNoteNumber: movements.deliveryNoteNumber,
        establishmentId: movements.establishmentId,
        establishmentName: establishments.name,
        userId: movements.userId,
        createdAt: movements.createdAt,
      })
      .from(movements)
      .leftJoin(suppliers, eq(movements.supplierId, suppliers.id))
      .leftJoin(establishments, eq(movements.establishmentId, establishments.id))
      .where(and(...conditions))
      .orderBy(desc(movements.createdAt))
      .limit(limit)

    if (rows.length === 0) {
      return { success: true, movements: [], count: 0 }
    }

    // 2. Lignes pour ces mouvements (évite N+1)
    const movementIds = rows.map((r) => r.id)
    const lines = await db
      .select({
        id: stockMovements.id,
        movementId: stockMovements.movementId,
        productId: stockMovements.productId,
        productName: products.name,
        variation: stockMovements.variation,
        quantity: stockMovements.quantity,
        oldStock: stockMovements.oldStock,
        newStock: stockMovements.newStock,
        reason: stockMovements.reason,
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .where(
        and(
          eq(stockMovements.tenantId, tenantId),
          inArray(stockMovements.movementId, movementIds),
        ),
      )

    const linesByMovementId = new Map<number, typeof lines>()
    for (const line of lines) {
      if (line.movementId == null) continue
      const list = linesByMovementId.get(line.movementId) ?? []
      list.push(line)
      linesByMovementId.set(line.movementId, list)
    }

    const formatted = rows.map((row) => {
      const items = (linesByMovementId.get(row.id) ?? []).map((line) => ({
        id: line.id,
        productId: line.productId,
        productName: line.productName || 'Produit inconnu',
        variation: line.variation,
        quantity: line.quantity,
        oldStock: line.oldStock,
        newStock: line.newStock,
        reason: line.reason,
      }))
      return {
        id: row.id,
        movementNumber: row.movementNumber,
        type: row.type,
        comment: row.comment,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        deliveryNoteNumber: row.deliveryNoteNumber,
        establishmentId: row.establishmentId,
        establishmentName: row.establishmentName,
        userId: row.userId,
        createdAt: row.createdAt,
        itemCount: items.length,
        totalQuantity: items.reduce((sum, it) => sum + Math.abs(it.quantity || 0), 0),
        items,
      }
    })

    logger.info(
      { count: formatted.length, dateFrom, dateTo, type: typeParam },
      "Historique mouvements récupéré",
    )

    return {
      success: true,
      movements: formatted,
      count: formatted.length,
    }
  } catch (error) {
    logger.error({ err: error }, "Erreur lors de la récupération de l'historique des mouvements")
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
