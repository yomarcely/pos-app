import { db } from '~/server/database/connection'
import { sales, saleItems, stockMovements, auditLogs, products, variations } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import { getRequestIP } from 'h3'

/**
 * ==========================================
 * API: Annuler une vente
 * ==========================================
 *
 * POST /api/sales/:id/cancel
 *
 * Annule une vente et restaure les stocks
 */

interface CancelSaleRequest {
  reason: string
  userId?: number
}

export default defineEventHandler(async (event) => {
  try {
    const id = Number(getRouterParam(event, 'id'))
    const body = await readBody<CancelSaleRequest>(event)

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID de vente manquant',
      })
    }

    if (!body.reason) {
      throw createError({
        statusCode: 400,
        message: 'Raison d\'annulation manquante',
      })
    }

    // ==========================================
    // 1. RÉCUPÉRER LA VENTE
    // ==========================================
    const [sale] = await db
      .select()
      .from(sales)
      .where(eq(sales.id, id))
      .limit(1)

    if (!sale) {
      throw createError({
        statusCode: 404,
        message: 'Vente non trouvée',
      })
    }

    // Vérifier que la vente n'est pas déjà annulée
    if (sale.status === 'cancelled') {
      throw createError({
        statusCode: 400,
        message: 'Cette vente est déjà annulée',
      })
    }

    // ==========================================
    // 2. RÉCUPÉRER LES ITEMS DE LA VENTE
    // ==========================================
    const items = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, id))

    // ==========================================
    // 3. RESTAURER LES STOCKS
    // ==========================================
    const stockMovementsData = []

    for (const item of items) {
      // Récupérer le produit
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1)

      if (!product) {
        console.warn(`Produit ${item.productId} non trouvé, stock non restauré`)
        continue
      }

      let oldStock = 0
      let newStock = 0

      const stockByVar = product.stockByVariation as Record<string, number> | null
      let variationKey: string | null = item.variation || null

      if (variationKey && stockByVar) {
        if (!(variationKey in stockByVar)) {
          const numericKey = Number(variationKey)
          if (Number.isFinite(numericKey) && String(numericKey) in stockByVar) {
            variationKey = String(numericKey)
          } else {
            const [foundVar] = await db
              .select({ id: variations.id })
              .from(variations)
              .where(eq(variations.name, variationKey))
              .limit(1)
            if (foundVar && String(foundVar.id) in stockByVar) {
              variationKey = String(foundVar.id)
            } else {
              console.warn(`Variation "${variationKey}" inconnue pour produit ${item.productId}, stock non restauré pour cette ligne`)
              variationKey = null
            }
          }
        }
      }

      // Restaurer le stock selon le type (avec ou sans variation)
      if (variationKey && stockByVar) {
        oldStock = stockByVar[variationKey] || 0
        newStock = oldStock + item.quantity // Ajouter car on annule une sortie

        stockByVar[variationKey] = newStock

        await db
          .update(products)
          .set({
            stockByVariation: stockByVar,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId))
      } else {
        oldStock = product.stock || 0
        newStock = oldStock + item.quantity

        await db
          .update(products)
          .set({
            stock: newStock,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId))
      }

      // Enregistrer le mouvement de stock d'annulation
      stockMovementsData.push({
        productId: item.productId,
        variation: item.variation || null,
        quantity: item.quantity, // Positif car on remet en stock
        oldStock,
        newStock,
        reason: 'sale_cancellation' as const,
        saleId: id,
        userId: body.userId || null,
      })

      console.log(`✅ Stock restauré pour produit ${item.productId}${item.variation ? ` (${item.variation})` : ''}: ${oldStock} → ${newStock}`)
    }

    if (stockMovementsData.length > 0) {
      await db.insert(stockMovements).values(stockMovementsData)
    }

    // ==========================================
    // 4. MARQUER LA VENTE COMME ANNULÉE
    // ==========================================
    await db
      .update(sales)
      .set({
        status: 'cancelled',
        cancellationReason: body.reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sales.id, id))

    // ==========================================
    // 5. ENREGISTRER DANS L'AUDIT LOG (NF525)
    // ==========================================
    await db.insert(auditLogs).values({
      userId: body.userId || null,
      userName: 'System', // TODO: Récupérer le nom de l'utilisateur connecté
      entityType: 'sale',
      entityId: id,
      action: 'delete',
      changes: {
        ticketNumber: sale.ticketNumber,
        totalTTC: Number(sale.totalTTC),
        reason: body.reason,
        status: 'cancelled',
        itemsCount: items.length,
      },
      metadata: {
        originalSaleDate: sale.saleDate,
        cancelledAt: new Date(),
        stockRestored: true,
      },
      ipAddress: getRequestIP(event) || null,
    })

    console.log(`📝 Annulation de vente enregistrée dans l'audit log (vente ${id})`)

    return {
      success: true,
      message: 'Vente annulée et stocks restaurés',
      sale: {
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    }
  } catch (error) {
    console.error('Erreur lors de l\'annulation de la vente:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
