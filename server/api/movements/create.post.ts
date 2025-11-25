import { db } from '~/server/database/connection'
import { products, stockMovements } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import { createMovement } from '~/server/utils/createMovement'

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
  userId?: number
  items: MovementItem[]
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateMovementRequest>(event)

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

    const reason = reasonMap[body.type]

    const result = await db.transaction(async (tx) => {
      // 1. Créer le mouvement principal
      const movement = await createMovement(body.type, body.comment, body.userId)

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

        // Créer la ligne de mouvement de stock
        await tx.insert(stockMovements).values({
          movementId: movement.id,
          productId: item.productId,
          variation: item.variation || null,
          quantity: quantityDelta,
          oldStock,
          newStock,
          reason,
          userId: body.userId || null,
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

    console.log(`📦 Mouvement ${result.movement.movementNumber} créé avec ${body.items.length} article(s)`)

    return {
      success: true,
      movement: result.movement,
      details: result.stockMovements,
    }
  } catch (error: any) {
    console.error('Erreur lors de la création du mouvement:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Erreur lors de la création du mouvement',
    })
  }
})
