import { db } from '~/server/database/connection'
import { products, stockMovements, productStocks } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { createMovement } from '~/server/utils/createMovement'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { z } from 'zod'

const movementItemSchema = z.object({
  productId: z.number().int().positive(),
  variation: z.string().optional(),
  quantity: z.number(),
  adjustmentType: z.enum(['add', 'set']).default('add'),
})

const createMovementSchema = z.object({
  type: z.enum(['reception', 'adjustment', 'loss', 'transfer']),
  comment: z.string().max(1000).optional(),
  items: z.array(movementItemSchema).min(1, 'Aucun article dans le mouvement'),
  establishmentId: z.number().int().positive().optional(),
})

/**
 * ==========================================
 * API: Créer un mouvement de stock groupé
 * ==========================================
 *
 * POST /api/movements/create
 *
 * Corps de la requête:
 * {
 *   type: 'reception' | 'adjustment' | 'loss' | 'transfer',
 *   comment?: string,
 *   userId?: number,
 *   items: [{
 *     productId: number,
 *     variation?: string,
 *     quantity: number,
 *     adjustmentType: 'add' | 'set'
 *   }]
 * }
 */

interface MovementItem {
  productId: number
  variation?: string
  quantity: number
  adjustmentType: 'add' | 'set'
}

interface CreateMovementRequest {
  type: 'reception' | 'adjustment' | 'loss' | 'transfer'
  comment?: string
  items: MovementItem[]
  establishmentId?: number
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const auth = event.context.auth
    const userId = auth?.user?.id || null
    const body = await validateBody<CreateMovementRequest>(event, createMovementSchema)

    // Validation
    if (!body.type) {
      throw createError({
        statusCode: 400,
        message: 'Type de mouvement manquant',
      })
    }

    if (!body.items || body.items.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Aucun article dans le mouvement',
      })
    }

    // Mapper le type vers le reason pour stock_movements
    const reasonMap: Record<string, string> = {
      reception: 'reception',
      adjustment: 'inventory_adjustment',
      loss: 'loss',
      transfer: 'transfer',
    }

    const reason = reasonMap[body.type] ?? 'inventory_adjustment'

    const result = await db.transaction(async (tx) => {
      // 1. Créer le mouvement principal
      const movement = await createMovement(body.type, body.comment, undefined, tenantId)

      // 2. Créer les lignes de stock_movements
      const stockMovementsData = []

      for (const item of body.items) {
        // Récupérer le produit
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1)

        if (!product) {
          throw createError({
            statusCode: 404,
            message: `Produit #${item.productId} non trouvé`,
          })
        }

        let oldStock = 0
        let newStock = 0
        let quantityDelta = 0

        // Calculer le nouveau stock
        if (item.variation && product.stockByVariation) {
          const stockByVar = product.stockByVariation as Record<string, number>
          oldStock = stockByVar[item.variation] || 0

          if (item.adjustmentType === 'add') {
            newStock = oldStock + item.quantity
            quantityDelta = item.quantity
          } else {
            newStock = item.quantity
            quantityDelta = item.quantity - oldStock
          }

          // Mettre à jour le stock de la variation
          stockByVar[item.variation] = newStock

          await tx
            .update(products)
            .set({
              stockByVariation: stockByVar,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId))
        } else {
          oldStock = product.stock || 0

          if (item.adjustmentType === 'add') {
            newStock = oldStock + item.quantity
            quantityDelta = item.quantity
          } else {
            newStock = item.quantity
            quantityDelta = item.quantity - oldStock
          }

          await tx
            .update(products)
            .set({
              stock: newStock,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId))
        }

        // Mettre à jour le stock par établissement si fourni
        if (body.establishmentId) {
          const [stockRecord] = await tx
            .select()
            .from(productStocks)
            .where(
              and(
                eq(productStocks.productId, item.productId),
                eq(productStocks.establishmentId, body.establishmentId),
                eq(productStocks.tenantId, tenantId)
              )
            )
            .limit(1)

          if (stockRecord) {
            if (item.variation) {
              type VarStock = { variationId: string; stock: number }
              const varStocks: VarStock[] = Array.isArray(stockRecord.stockByVariation)
                ? (stockRecord.stockByVariation as VarStock[])
                : []
              const estOldStock = varStocks.find(v => v.variationId === item.variation)?.stock || 0
              const estNewStock = item.adjustmentType === 'add'
                ? estOldStock + item.quantity
                : item.quantity
              const updated = varStocks.filter(v => v.variationId !== item.variation)
              updated.push({ variationId: item.variation, stock: estNewStock })
              await tx.update(productStocks)
                .set({ stockByVariation: updated, updatedAt: new Date() })
                .where(eq(productStocks.id, stockRecord.id))
            } else {
              const estOldStock = stockRecord.stock || 0
              const estNewStock = item.adjustmentType === 'add'
                ? estOldStock + item.quantity
                : item.quantity
              await tx.update(productStocks)
                .set({ stock: estNewStock, updatedAt: new Date() })
                .where(eq(productStocks.id, stockRecord.id))
            }
          }
        }

        // Créer la ligne de mouvement de stock
        await tx.insert(stockMovements).values({
          tenantId,
          movementId: movement.id,
          productId: item.productId,
          variation: item.variation || null,
          quantity: quantityDelta,
          oldStock,
          newStock,
          reason,
          userId: null,
        })

        stockMovementsData.push({
          productId: item.productId,
          variation: item.variation,
          oldStock,
          newStock,
          quantityDelta,
        })
      }

      return {
        movement,
        stockMovements: stockMovementsData,
      }
    })

    logger.info({
      movementNumber: result.movement.movementNumber,
      itemsCount: body.items.length,
      type: body.type
    }, 'Mouvement de stock créé')

    return {
      success: true,
      movement: result.movement,
      details: result.stockMovements,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la création du mouvement')

    const statusCode = error instanceof Error && 'statusCode' in error ? (error as { statusCode: number }).statusCode : 500
    const message = error instanceof Error ? error.message : 'Erreur lors de la création du mouvement'

    throw createError({
      statusCode,
      message,
    })
  }
})
