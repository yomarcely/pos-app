import { db } from '~/server/database/connection'
import { sales, saleItems, stockMovements, auditLogs, products, variations } from '~/server/database/schema'
import { desc, gte, lt, and, eq } from 'drizzle-orm'
import {
  generateTicketNumber,
  generateTicketHash,
  generateTicketSignature,
  type TicketData,
} from '~/server/utils/nf525'
import { getTenantId } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Créer une vente (NF525 conforme)
 * ==========================================
 *
 * POST /api/sales/create
 *
 * Corps de la requête:
 * {
 *   items: [{ productId, productName, quantity, unitPrice, variation, discount, discountType, tva }],
 *   seller: { id, name },
 *   customer?: { id, firstName, lastName },
 *   payments: [{ mode, amount }],
 *   totals: { totalHT, totalTVA, totalTTC },
 *   globalDiscount: { value, type }
 * }
 */

interface CreateSaleRequest {
  items: Array<{
    productId: number
    productName: string
    quantity: number
    originalPrice?: number // Prix d'origine avant remise
    unitPrice: number // Prix final après remise
    variation?: string
    discount: number
    discountType: '%' | '€'
    tva: number
  }>
  seller: {
    id: number
    name: string
  }
  customer?: {
    id: number
    firstName: string
    lastName: string
  } | null
  payments: Array<{
    mode: string
    amount: number
  }>
  totals: {
    totalHT: number
    totalTVA: number
    totalTTC: number
  }
  globalDiscount: {
    value: number
    type: '%' | '€'
  }
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateSaleRequest>(event)

    // Validation des données
    if (!body.items || body.items.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Le panier est vide',
      })
    }

    if (!body.seller || !body.seller.id) {
      throw createError({
        statusCode: 400,
        message: 'Vendeur manquant',
      })
    }

    if (!body.payments || body.payments.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Mode de paiement manquant',
      })
    }

    // ==========================================
    // 1. RÉCUPÉRER LE DERNIER TICKET (CHAÎNAGE)
    // ==========================================

    const lastSale = await db
      .select({
        ticketNumber: sales.ticketNumber,
        currentHash: sales.currentHash,
      })
      .from(sales)
      .orderBy(desc(sales.id))
      .limit(1)

    const previousHash = lastSale.length > 0 ? lastSale[0].currentHash : null

    // ==========================================
    // 2. GÉNÉRER LE NUMÉRO DE TICKET
    // ==========================================

    // Compter les tickets du jour pour la séquence
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
    const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0, 0)

    const todaySales = await db
      .select({ id: sales.id })
      .from(sales)
      .where(
        and(
          gte(sales.saleDate, todayStart),
          lt(sales.saleDate, tomorrowStart)
        )
      )

    const sequenceNumber = todaySales.length + 1
    const ticketNumber = generateTicketNumber(sequenceNumber)

    // ==========================================
    // 3. GÉNÉRER LE HASH NF525
    // ==========================================

    const ticketData: TicketData = {
      ticketNumber,
      saleDate: new Date(),
      totalTTC: body.totals.totalTTC,
      sellerId: body.seller.id,
      items: body.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalTTC: item.quantity * item.unitPrice, // Simplifié pour le hash
      })),
    }

    const currentHash = generateTicketHash(ticketData, previousHash)

    // ==========================================
    // 4. GÉNÉRER LA SIGNATURE INFOCERT
    // ==========================================

    // TODO: Utiliser la vraie clé INFOCERT en production
    const privateKey = process.env.INFOCERT_PRIVATE_KEY
    const signature = generateTicketSignature(currentHash, privateKey)

    // ==========================================
    // 5. TRANSACTION: ENREGISTRER LA VENTE + OPÉRATIONS LIÉES
    // ==========================================

    const { newSale, saleItemsData, stockUpdateLogs } = await db.transaction(async (tx) => {
      // 5.1 Enregistrer la vente
      const tenantId = getTenantId(event)

      const [createdSale] = await tx
        .insert(sales)
        .values({
          tenantId,
          ticketNumber,
          saleDate: new Date(),
          totalHT: body.totals.totalHT.toString(),
          totalTVA: body.totals.totalTVA.toString(),
          totalTTC: body.totals.totalTTC.toString(),
          globalDiscount: body.globalDiscount.value.toString(),
          globalDiscountType: body.globalDiscount.type,
          sellerId: body.seller.id,
          customerId: body.customer?.id || null,
          payments: body.payments,
          previousHash,
          currentHash,
          signature,
          status: 'completed',
        })
        .returning()

      // 5.2 Enregistrer les lignes de vente
      const saleItemsData = body.items.map(item => {
        // Le unitPrice est déjà le prix final après remise
        const totalTTC = item.unitPrice * item.quantity
        const totalHT = totalTTC / (1 + item.tva / 100)

        return {
          tenantId,
          saleId: createdSale.id,
          productId: item.productId,
          productName: item.productName,
          variation: item.variation || null,
          quantity: item.quantity,
          originalPrice: item.originalPrice?.toString() || null,
          unitPrice: item.unitPrice.toString(),
          discount: item.discount.toString(),
          discountType: item.discountType,
          tva: item.tva.toString(),
          totalHT: totalHT.toFixed(2),
          totalTTC: totalTTC.toFixed(2),
        }
      })

      await tx.insert(saleItems).values(saleItemsData)

      // 5.3 Mettre à jour le stock et enregistrer les mouvements
      const stockMovementsData = []
      const stockUpdateLogs: string[] = []

      for (const item of body.items) {
        // Récupérer le produit pour obtenir le stock actuel
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1)

        if (!product) {
          console.warn(`Produit ${item.productId} non trouvé, stock non mis à jour`)
          continue
        }

        let oldStock = 0
        let newStock = 0

        // Mise à jour du stock selon le type (avec ou sans variation)
        const stockByVar = product.stockByVariation as Record<string, number> | null
        let variationKey: string | null = item.variation || null

        // Normaliser la clé de variation : préférer l'ID si on part d'un nom
        if (variationKey && stockByVar) {
          if (!(variationKey in stockByVar)) {
            const numericKey = Number(variationKey)
            if (Number.isFinite(numericKey) && String(numericKey) in stockByVar) {
              variationKey = String(numericKey)
            } else {
              const [foundVar] = await tx
                .select({ id: variations.id })
                .from(variations)
                .where(eq(variations.name, variationKey))
                .limit(1)
              if (foundVar && String(foundVar.id) in stockByVar) {
                variationKey = String(foundVar.id)
              } else {
                console.warn(`Variation "${variationKey}" inconnue pour produit ${item.productId}, stock non mis à jour pour cette ligne`)
                variationKey = null
              }
            }
          }
        }

        if (variationKey && stockByVar) {
          oldStock = stockByVar[variationKey] || 0
          newStock = oldStock - item.quantity
          stockByVar[variationKey] = newStock

          await tx
            .update(products)
            .set({
              stockByVariation: stockByVar,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId))
        } else {
          oldStock = product.stock || 0
          newStock = oldStock - item.quantity

          // Mettre à jour le stock principal
          await tx
            .update(products)
            .set({
              stock: newStock,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId))
        }

        // Enregistrer le mouvement de stock
        stockMovementsData.push({
          tenantId,
          productId: item.productId,
          variation: item.variation || null,
          quantity: -item.quantity, // Négatif car sortie de stock
          oldStock,
          newStock,
          reason: 'sale' as const,
          saleId: createdSale.id,
          userId: body.seller.id,
        })

        stockUpdateLogs.push(`✅ Stock mis à jour pour produit ${item.productId}${item.variation ? ` (${item.variation})` : ''}: ${oldStock} → ${newStock}`)
      }

      if (stockMovementsData.length > 0) {
        await tx.insert(stockMovements).values(stockMovementsData)
      }

      // 5.4 Log d'audit
      await tx.insert(auditLogs).values({
        tenantId,
        userId: body.seller.id,
        userName: body.seller.name,
        entityType: 'sale',
        entityId: createdSale.id,
        action: 'create',
        changes: {
          ticketNumber,
          totalTTC: body.totals.totalTTC,
          items: body.items.length,
        },
        metadata: {
          hash: currentHash,
          signature,
        },
        ipAddress: getRequestIP(event) || null,
      })

      return { newSale: createdSale, saleItemsData, stockUpdateLogs }
    })

    stockUpdateLogs.forEach(log => console.log(log))

    // ==========================================
    // 10. RETOURNER LA RÉPONSE
    // ==========================================

    return {
      success: true,
      sale: {
        id: newSale.id,
        ticketNumber: newSale.ticketNumber,
        saleDate: newSale.saleDate,
        totalTTC: newSale.totalTTC,
        hash: newSale.currentHash,
        signature: newSale.signature,
      },
    }
  } catch (error) {
    console.error('Erreur lors de la création de la vente:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
