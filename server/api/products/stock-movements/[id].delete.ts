import { db } from '~/server/database/connection'
import { stockMovements, products, auditLogs } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { getRequestIP } from 'h3'

/**
 * ==========================================
 * API: Supprimer un mouvement de stock et annuler son effet
 * ==========================================
 *
 * DELETE /api/products/stock-movements/:id
 *
 * Supprime un ajustement de stock et annule son effet sur le stock du produit
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(getRouterParam(event, 'id'))

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID du mouvement manquant',
      })
    }

    // Récupérer le mouvement
    const [movement] = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.id, id),
          eq(stockMovements.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!movement) {
      throw createError({
        statusCode: 404,
        message: 'Mouvement non trouvé',
      })
    }

    // Vérifier que ce n'est pas un mouvement de vente (sécurité)
    if (movement.reason === 'sale' || movement.reason === 'sale_cancellation') {
      throw createError({
        statusCode: 403,
        message: 'Impossible de supprimer un mouvement de vente. Utilisez l\'annulation de vente.',
      })
    }

    // Récupérer le produit
    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, movement.productId),
          eq(products.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!product) {
      throw createError({
        statusCode: 404,
        message: 'Produit non trouvé',
      })
    }

    // Annuler l'effet du mouvement sur le stock
    let currentStockBeforeDeletion = 0
    let stockAfterDeletion = 0

    if (movement.variation && product.stockByVariation) {
      const stockByVar = product.stockByVariation as Record<string, number>
      currentStockBeforeDeletion = stockByVar[movement.variation] || 0

      // Annuler le mouvement : retirer la quantité qui avait été ajoutée/retirée
      stockAfterDeletion = currentStockBeforeDeletion - movement.quantity

      stockByVar[movement.variation] = stockAfterDeletion

      await db
        .update(products)
        .set({
          stockByVariation: stockByVar,
          updatedAt: new Date(),
        })
        .where(eq(products.id, movement.productId))

      console.log(`✅ Stock restauré pour ${product.name} (${movement.variation}): ${currentStockBeforeDeletion} → ${stockAfterDeletion}`)
    } else {
      currentStockBeforeDeletion = product.stock || 0

      // Annuler le mouvement
      stockAfterDeletion = currentStockBeforeDeletion - movement.quantity

      await db
        .update(products)
        .set({
          stock: stockAfterDeletion,
          updatedAt: new Date(),
        })
        .where(eq(products.id, movement.productId))

      console.log(`✅ Stock restauré pour ${product.name}: ${currentStockBeforeDeletion} → ${stockAfterDeletion}`)
    }

    // Supprimer le mouvement de stock
    await db
      .delete(stockMovements)
      .where(
        and(
          eq(stockMovements.id, id),
          eq(stockMovements.tenantId, tenantId)
        )
      )

    // Enregistrer la suppression dans l'audit log (NF525)
    await db.insert(auditLogs).values({
      tenantId,
      userId: movement.userId,
      userName: 'System', // TODO: Récupérer le nom de l'utilisateur connecté
      entityType: 'stock_movement',
      entityId: movement.id,
      action: 'delete',
      changes: {
        productId: movement.productId,
        productName: product.name,
        variation: movement.variation,
        quantity: movement.quantity,
        reason: movement.reason,
        stockRestored: true,
      },
      metadata: {
        oldStockBeforeMovement: movement.oldStock,
        newStockAfterMovement: movement.newStock,
        currentStockBeforeDeletion,
        stockAfterDeletion,
      },
      ipAddress: getRequestIP(event) || null,
    })

    console.log(`📝 Suppression enregistrée dans l'audit log pour le mouvement ${id}`)

    return {
      success: true,
      message: 'Mouvement supprimé et stock restauré',
      movement: {
        id: movement.id,
        productId: movement.productId,
        quantity: movement.quantity,
      },
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du mouvement:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
