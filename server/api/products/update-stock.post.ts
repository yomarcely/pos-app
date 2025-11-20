import { db } from '~/server/database/connection'
import { products, stockMovements, auditLogs } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import { getRequestIP } from 'h3'

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
    const body = await readBody<UpdateStockRequest>(event)

    // Validation
    if (!body.productId) {
      throw createError({
        statusCode: 400,
        message: 'ID du produit manquant',
      })
    }

    if (body.quantity < 0) {
      throw createError({
        statusCode: 400,
        message: 'La quantité ne peut pas être négative',
      })
    }

    // Récupérer le produit
    const [product] = await db
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

      await db
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
      await db
        .update(products)
        .set({
          stock: newStock,
          updatedAt: new Date(),
        })
        .where(eq(products.id, body.productId))
    }

    // Enregistrer le mouvement de stock
    const [movement] = await db.insert(stockMovements).values({
      productId: body.productId,
      variation: body.variation || null,
      quantity: quantityDelta,
      oldStock,
      newStock,
      reason: body.reason,
      userId: body.userId || null,
    }).returning()

    console.log(`✅ Stock mis à jour pour produit ${body.productId}${body.variation ? ` (${body.variation})` : ''}: ${oldStock} → ${newStock}`)

    // Enregistrer la création de l'ajustement dans l'audit log (NF525)
    await db.insert(auditLogs).values({
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

    console.log(`📝 Ajustement enregistré dans l'audit log (mouvement ${movement.id})`)

    return {
      success: true,
      stock: {
        productId: body.productId,
        variation: body.variation,
        oldStock,
        newStock,
        delta: quantityDelta,
      },
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du stock:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
