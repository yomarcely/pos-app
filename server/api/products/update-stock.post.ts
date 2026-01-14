import { db } from '~/server/database/connection'
import { products, stockMovements, auditLogs } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import { getRequestIP } from 'h3'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateStockSchema, type UpdateStockInput } from '~/server/validators/product.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Mettre à jour le stock d'un produit
 * ==========================================
 *
 * POST /api/products/update-stock
 *
 * Corps de la requête:
 * {
 *   productId: number,
 *   variation?: string,
 *   quantity: number,
 *   adjustmentType: 'add' | 'set',
 *   reason: 'reception' | 'inventory_adjustment' | 'loss' | 'return',
 *   userId?: number
 * }
 */

interface UpdateStockRequest {
  productId: number
  variation?: string
  quantity: number
  adjustmentType: 'add' | 'set'
  reason: 'reception' | 'inventory_adjustment' | 'loss' | 'return'
  userId?: number
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await validateBody<UpdateStockInput>(event, updateStockSchema)

    // Validation
    if (!body.productId) {
      throw createError({
        statusCode: 400,
        message: 'ID du produit manquant',
      })
    }

    // Permettre les quantités négatives en mode 'add' pour retirer du stock
    // En mode 'set', accepter toute valeur (même 0 ou négative) pour définir le stock
    if (body.adjustmentType === 'set' && body.quantity < 0) {
      throw createError({
        statusCode: 400,
        message: 'Le stock ne peut pas être défini à une valeur négative',
      })
    }

    const transactionResult = await db.transaction(async (tx) => {
      // Récupérer le produit
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, body.productId))
        .limit(1)

      if (!product) {
        throw createError({
          statusCode: 404,
          message: 'Produit non trouvé',
        })
      }

      let oldStock = 0
      let newStock = 0
      let quantityDelta = 0

      // Mise à jour du stock selon le type (avec ou sans variation)
      if (body.variation && product.stockByVariation) {
        const stockByVar = product.stockByVariation as Record<string, number>
        oldStock = stockByVar[body.variation] || 0

        if (body.adjustmentType === 'add') {
          newStock = oldStock + body.quantity
          quantityDelta = body.quantity
        } else {
          newStock = body.quantity
          quantityDelta = body.quantity - oldStock
        }

        // Mettre à jour le stock de la variation
        stockByVar[body.variation] = newStock

        await tx
          .update(products)
          .set({
            stockByVariation: stockByVar,
            updatedAt: new Date(),
          })
          .where(eq(products.id, body.productId))
      } else {
        oldStock = product.stock || 0

        if (body.adjustmentType === 'add') {
          newStock = oldStock + body.quantity
          quantityDelta = body.quantity
        } else {
          newStock = body.quantity
          quantityDelta = body.quantity - oldStock
        }

        // Mettre à jour le stock principal
        await tx
          .update(products)
          .set({
            stock: newStock,
            updatedAt: new Date(),
          })
          .where(eq(products.id, body.productId))
      }

      // Enregistrer le mouvement de stock
      const [movement] = await tx.insert(stockMovements).values({
        tenantId,
        productId: body.productId,
        variation: body.variation || null,
        quantity: quantityDelta,
        oldStock,
        newStock,
        reason: body.reason,
        userId: body.userId || null,
      }).returning()

      // Enregistrer la création de l'ajustement dans l'audit log (NF525)
      await tx.insert(auditLogs).values({
        tenantId,
        userId: body.userId || null,
        userName: 'System', // TODO: Récupérer le nom de l'utilisateur connecté
        entityType: 'stock_movement',
        entityId: movement.id,
        action: 'create',
        changes: {
          productId: body.productId,
          productName: product.name,
          variation: body.variation || null,
          quantity: quantityDelta,
          adjustmentType: body.adjustmentType,
          reason: body.reason,
        },
        metadata: {
          oldStock,
          newStock,
          quantityInput: body.quantity,
        },
        ipAddress: getRequestIP(event) || null,
      })

      return {
        oldStock,
        newStock,
        quantityDelta,
        movementId: movement.id,
      }
    })

    logger.info({
      productId: body.productId,
      variation: body.variation,
      oldStock: transactionResult.oldStock,
      newStock: transactionResult.newStock,
      movementId: transactionResult.movementId,
    }, 'Stock mis à jour pour produit')

    return {
      success: true,
      stock: {
        productId: body.productId,
        variation: body.variation,
        oldStock: transactionResult.oldStock,
        newStock: transactionResult.newStock,
        delta: transactionResult.quantityDelta,
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour du stock')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
