import { db } from '~/server/database/connection'
import { sales, saleItems } from '~/server/database/schema'
import { desc, gte, lt, and, eq, sql, inArray } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Synthèse journalière des ventes
 * ==========================================
 *
 * GET /api/sales/daily-summary?date=YYYY-MM-DD
 *
 * Récupère toutes les statistiques pour une journée donnée
 *
 * Performance: Utilise des agrégations SQL au lieu de calculs en mémoire
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const dateParam = query.date as string
    const registerIdParam = query.registerId as string
    const establishmentIdParam = query.establishmentId as string

    // Date par défaut: aujourd'hui
    const targetDate = dateParam ? new Date(dateParam) : new Date()

    // Début et fin de la journée
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Filtres optionnels
    const registerId = registerIdParam ? Number(registerIdParam) : null
    const establishmentId = establishmentIdParam ? Number(establishmentIdParam) : null

    // ==========================================
    // 1. CALCULER LES STATISTIQUES AVEC SQL
    // ==========================================

    // Construction des conditions WHERE dynamiques
    const baseConditions = [
      eq(sales.tenantId, tenantId),
      gte(sales.saleDate, startOfDay),
      lt(sales.saleDate, endOfDay),
    ]

    if (registerId) {
      baseConditions.push(eq(sales.registerId, registerId))
    }

    if (establishmentId) {
      baseConditions.push(eq(sales.establishmentId, establishmentId))
    }

    // Agrégations pour les ventes actives
    const [activeSalesStats] = await db
      .select({
        totalTTC: sql<string>`COALESCE(SUM(CAST(${sales.totalTTC} AS NUMERIC)), 0)`,
        totalHT: sql<string>`COALESCE(SUM(CAST(${sales.totalHT} AS NUMERIC)), 0)`,
        totalTVA: sql<string>`COALESCE(SUM(CAST(${sales.totalTVA} AS NUMERIC)), 0)`,
        ticketCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(sales)
      .where(
        and(
          ...baseConditions,
          eq(sales.status, 'completed')
        )
      )

    // Nombre de ventes annulées
    const [cancelledStats] = await db
      .select({
        returnCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(sales)
      .where(
        and(
          ...baseConditions,
          eq(sales.status, 'cancelled')
        )
      )

    // Quantité totale de produits vendus (ventes actives uniquement)
    const [quantityStats] = await db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(
        and(
          ...baseConditions,
          eq(sales.status, 'completed')
        )
      )

    // ==========================================
    // 2. RÉCUPÉRER LES VENTES POUR CALCULS COMPLEXES
    // ==========================================
    // Note: payments et discounts nécessitent encore du traitement en mémoire
    // car ils sont stockés en JSONB
    const dailySales = await db
      .select()
      .from(sales)
      .where(and(...baseConditions))
      .orderBy(desc(sales.saleDate))

    const activeSales = dailySales.filter(s => s.status === 'completed')

    // ==========================================
    // 3. CALCULER PAIEMENTS (JSONB - en mémoire)
    // ==========================================
    interface PaymentEntry {
      mode: string
      amount: number
    }

    const paymentMethods: Record<string, { amount: number; count: number }> = {}

    activeSales.forEach(sale => {
      const payments = sale.payments as PaymentEntry[]
      payments.forEach(payment => {
        if (!paymentMethods[payment.mode]) {
          paymentMethods[payment.mode] = { amount: 0, count: 0 }
        }
        paymentMethods[payment.mode].amount += payment.amount
        paymentMethods[payment.mode].count += 1
      })
    })

    // ==========================================
    // 4. CALCULER REMISES (optimisé)
    // ==========================================
    // On récupère uniquement les items nécessaires au calcul des remises
    const saleIds = activeSales.map(s => s.id)
    let discountCount = 0
    let totalDiscountValue = 0

    if (saleIds.length > 0) {
      const itemsWithDiscounts = await db
        .select({
          saleId: saleItems.saleId,
          discount: saleItems.discount,
          discountType: saleItems.discountType,
          unitPrice: saleItems.unitPrice,
          quantity: saleItems.quantity,
        })
        .from(saleItems)
        .where(inArray(saleItems.saleId, saleIds))

      activeSales.forEach(sale => {
        // Remise globale
        if (sale.globalDiscount && Number(sale.globalDiscount) > 0) {
          discountCount += 1
          const discount = Number(sale.globalDiscount)
          if (sale.globalDiscountType === '%') {
            totalDiscountValue += (Number(sale.totalTTC) * discount) / (100 - discount)
          } else {
            totalDiscountValue += discount
          }
        }

        // Remises par ligne
        const saleItemsList = itemsWithDiscounts.filter(item => item.saleId === sale.id)
        saleItemsList.forEach(item => {
          if (item.discount && Number(item.discount) > 0) {
            discountCount += 1
            const discount = Number(item.discount)
            if (item.discountType === '%') {
              const discountValue = (Number(item.unitPrice) * item.quantity * discount) / 100
              totalDiscountValue += discountValue
            } else {
              totalDiscountValue += discount
            }
          }
        })
      })
    }

    // ==========================================
    // 5. CALCULER MOYENNES
    // ==========================================
    const totalTTC = Number(activeSalesStats.totalTTC)
    const totalHT = Number(activeSalesStats.totalHT)
    const totalTVA = Number(activeSalesStats.totalTVA)
    const ticketCount = activeSalesStats.ticketCount
    const totalQuantity = quantityStats.totalQuantity
    const returnCount = cancelledStats.returnCount

    const avgBasketQuantity = ticketCount > 0 ? totalQuantity / ticketCount : 0
    const avgBasketValue = ticketCount > 0 ? totalTTC / ticketCount : 0

    // ==========================================
    // 6. RÉCUPÉRER ITEMS POUR DÉTAILS (si nécessaire)
    // ==========================================
    const saleIdsAll = dailySales.map(s => s.id)
    type SaleItemRow = typeof saleItems.$inferSelect
    let allItems: SaleItemRow[] = []

    if (saleIdsAll.length > 0) {
      allItems = await db
        .select()
        .from(saleItems)
        .where(inArray(saleItems.saleId, saleIdsAll))
    }

    // ==========================================
    // 4. FORMATER LES VENTES AVEC LEURS ITEMS
    // ==========================================
    const formattedSales = dailySales.map(sale => {
      const items = allItems.filter(item => item.saleId === sale.id)

      return {
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        saleDate: sale.saleDate,
        totalHT: Number(sale.totalHT),
        totalTVA: Number(sale.totalTVA),
        totalTTC: Number(sale.totalTTC),
        payments: sale.payments,
        globalDiscount: sale.globalDiscount ? Number(sale.globalDiscount) : 0,
        globalDiscountType: sale.globalDiscountType,
        status: sale.status,
        cancellationReason: sale.cancellationReason,
        cancelledAt: sale.cancelledAt,
        sellerId: sale.sellerId,
        customerId: sale.customerId,
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          variation: item.variation,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discount: item.discount ? Number(item.discount) : 0,
          discountType: item.discountType,
          tva: Number(item.tva),
          totalHT: Number(item.totalHT),
          totalTTC: Number(item.totalTTC),
        })),
      }
    })

    // ==========================================
    // 5. RETOURNER LA SYNTHÈSE
    // ==========================================
    return {
      success: true,
      date: targetDate.toISOString().split('T')[0],
      summary: {
        // Totaux généraux
        totalTTC,
        totalHT,
        totalTVA,

        // Statistiques
        ticketCount,
        totalQuantity,
        avgBasketQuantity: Number(avgBasketQuantity.toFixed(2)),
        avgBasketValue: Number(avgBasketValue.toFixed(2)),

        // Remises et retours
        discountCount,
        totalDiscountValue: Number(totalDiscountValue.toFixed(2)),
        returnCount,

        // Paiements
        paymentMethods,
      },
      sales: formattedSales,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération de la synthèse')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
