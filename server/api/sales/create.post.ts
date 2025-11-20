import { db } from '~/server/database/connection'
import { sales, saleItems, stockMovements, auditLogs, syncQueue } from '~/server/database/schema'
import { desc, gte, lt, and } from 'drizzle-orm'
import {
  generateTicketNumber,
  generateTicketHash,
  generateTicketSignature,
  type TicketData,
} from '~/server/utils/nf525'

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
    unitPrice: number
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
    // 5. ENREGISTRER LA VENTE EN BDD
    // ==========================================

    const [newSale] = await db
      .insert(sales)
      .values({
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
        syncStatus: 'pending',
      })
      .returning()

    // ==========================================
    // 6. ENREGISTRER LES LIGNES DE VENTE
    // ==========================================

    const saleItemsData = body.items.map(item => {
      const discount = item.discountType === '%'
        ? (item.unitPrice * item.quantity * item.discount) / 100
        : item.discount

      const totalHT = (item.unitPrice * item.quantity - discount) / (1 + item.tva / 100)
      const totalTTC = item.unitPrice * item.quantity - discount

      return {
        saleId: newSale.id,
        productId: item.productId,
        productName: item.productName,
        variation: item.variation || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        discount: item.discount.toString(),
        discountType: item.discountType,
        tva: item.tva.toString(),
        totalHT: totalHT.toFixed(2),
        totalTTC: totalTTC.toFixed(2),
      }
    })

    await db.insert(saleItems).values(saleItemsData)

    // ==========================================
    // 7. ENREGISTRER LES MOUVEMENTS DE STOCK
    // ==========================================

    // Note: Les stocks ont déjà été mis à jour côté client
    // Ici on enregistre uniquement les mouvements pour l'audit

    const stockMovementsData = body.items.map(item => ({
      productId: item.productId,
      variation: item.variation || null,
      quantity: -item.quantity, // Négatif car sortie de stock
      oldStock: 0, // TODO: Récupérer le stock réel depuis la BDD
      newStock: 0, // TODO: Calculer le nouveau stock
      reason: 'sale' as const,
      saleId: newSale.id,
      userId: body.seller.id,
    }))

    await db.insert(stockMovements).values(stockMovementsData)

    // ==========================================
    // 8. LOG D'AUDIT
    // ==========================================

    await db.insert(auditLogs).values({
      userId: body.seller.id,
      userName: body.seller.name,
      entityType: 'sale',
      entityId: newSale.id,
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

    // ==========================================
    // 9. AJOUTER À LA QUEUE DE SYNC CLOUD
    // ==========================================

    await db.insert(syncQueue).values({
      entityType: 'sale',
      entityId: newSale.id,
      action: 'create',
      data: {
        sale: newSale,
        items: saleItemsData,
      },
      status: 'pending',
    })

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
