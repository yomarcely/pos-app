import { db } from '~/server/database/connection'
import { productStocks, stockMovements, movements, products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { updateProductStockSchema } from '~/server/validators/sync.schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

type VariationStock = { variationId: string; stock: number }

/**
 * ==========================================
 * API: Mettre à jour le stock d'un produit par établissement
 * ==========================================
 *
 * POST /api/product-stocks/update
 *
 * Met à jour le stock d'un produit pour un établissement donné
 * et enregistre le mouvement dans l'historique
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await readBody(event)

    // Validation des données
    const validatedData = updateProductStockSchema.parse(body)
    const { productId, establishmentId, quantity, variation, adjustmentType, reason, userId } = validatedData

    // Récupérer le produit pour vérification
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))

    if (!product) {
      throw createError({
        statusCode: 404,
        message: 'Produit non trouvé',
      })
    }

    // Récupérer le stock actuel pour cet établissement
    const [currentStock] = await db
      .select()
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, productId),
          eq(productStocks.establishmentId, establishmentId),
          eq(productStocks.tenantId, tenantId)
        )
      )

    let oldStock = 0
    let newStock = 0

    // Gestion du stock par variation ou global
    if (variation) {
      // Stock par variation
      const stockByVariation: VariationStock[] = Array.isArray(currentStock?.stockByVariation)
        ? (currentStock?.stockByVariation as VariationStock[])
        : []
      const variationStock = stockByVariation.find((v) => v.variationId === variation)
      oldStock = variationStock?.stock || 0

      if (adjustmentType === 'add') {
        newStock = oldStock + quantity
      } else {
        newStock = quantity
      }

      // Mettre à jour le stock par variation
      const updatedStockByVariation = stockByVariation.filter((v) => v.variationId !== variation)
      updatedStockByVariation.push({ variationId: variation, stock: newStock })

      if (currentStock) {
        await db
          .update(productStocks)
          .set({
            stockByVariation: updatedStockByVariation,
            updatedAt: new Date(),
          })
          .where(eq(productStocks.id, currentStock.id))
      } else {
        // Créer le stock s'il n'existe pas
        await db.insert(productStocks).values({
          tenantId,
          productId,
          establishmentId,
          stock: 0,
          stockByVariation: updatedStockByVariation,
        })
      }
    } else {
      // Stock global
      oldStock = currentStock?.stock || 0

      if (adjustmentType === 'add') {
        newStock = oldStock + quantity
      } else {
        newStock = quantity
      }

      if (currentStock) {
        await db
          .update(productStocks)
          .set({
            stock: newStock,
            updatedAt: new Date(),
          })
          .where(eq(productStocks.id, currentStock.id))
      } else {
        // Créer le stock s'il n'existe pas
        await db.insert(productStocks).values({
          tenantId,
          productId,
          establishmentId,
          stock: newStock,
        })
      }
    }

    // Créer un mouvement de stock pour traçabilité
    const [movement] = await db
      .insert(movements)
      .values({
        tenantId,
        movementNumber: `ADJ-${Date.now()}`, // Temporaire, pourrait utiliser la fonction generate_movement_number
        type: adjustmentType === 'add' ? 'reception' : 'adjustment',
        comment: `Ajustement de stock - ${reason}`,
        userId,
      })
      .returning()

    await db.insert(stockMovements).values({
      tenantId,
      movementId: movement.id,
      productId,
      variation,
      establishmentId,
      quantity: adjustmentType === 'add' ? quantity : newStock - oldStock,
      oldStock,
      newStock,
      reason,
      userId,
    })

    return {
      success: true,
      oldStock,
      newStock,
      message: 'Stock mis à jour avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du stock:', error)

    // Erreur de validation Zod
    if (error && typeof error === 'object' && 'issues' in error) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
        data: error,
      })
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
