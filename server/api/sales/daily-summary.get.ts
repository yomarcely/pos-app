import { db } from '~/server/database/connection'
import { sales, saleItems, stockMovements } from '~/server/database/schema'
import { desc, gte, lt, and, eq, sql } from 'drizzle-orm'

/**
 * ==========================================
 * API: Synthèse journalière des ventes
 * ==========================================
 *
 * GET /api/sales/daily-summary?date=YYYY-MM-DD
 *
 * Récupère toutes les statistiques pour une journée donnée
 */

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const dateParam = query.date as string

    // Date par défaut: aujourd'hui
    const targetDate = dateParam ? new Date(dateParam) : new Date()

    // Début et fin de la journée
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // ==========================================
    // 1. RÉCUPÉRER TOUTES LES VENTES DU JOUR
    // ==========================================
    const dailySales = await db
      .select()
      .from(sales)
      .where(
        and(
          gte(sales.saleDate, startOfDay),
          lt(sales.saleDate, endOfDay)
        )
      )
      .orderBy(desc(sales.saleDate))

    // ==========================================
    // 2. RÉCUPÉRER LES ITEMS DE TOUTES LES VENTES
    // ==========================================
    const saleIds = dailySales.map(s => s.id)

    let allItems: any[] = []
    if (saleIds.length > 0) {
      allItems = await db
        .select()
        .from(saleItems)
        .where(sql`${saleItems.saleId} IN ${saleIds}`)
    }

    // ==========================================
    // 3. CALCULER LES STATISTIQUES
    // ==========================================

    // Ventes actives (non annulées)
    const activeSales = dailySales.filter(s => s.status === 'completed')
    const cancelledSales = dailySales.filter(s => s.status === 'cancelled')

    // Total encaissé par mode de règlement
    const paymentMethods: Record<string, { amount: number; count: number }> = {}

    activeSales.forEach(sale => {
      const payments = sale.payments as any[]
      payments.forEach(payment => {
        if (!paymentMethods[payment.mode]) {
          paymentMethods[payment.mode] = { amount: 0, count: 0 }
        }
        paymentMethods[payment.mode].amount += payment.amount
        paymentMethods[payment.mode].count += 1
      })
    })

    // Total général
    const totalTTC = activeSales.reduce((sum, s) => sum + Number(s.totalTTC), 0)
    const totalHT = activeSales.reduce((sum, s) => sum + Number(s.totalHT), 0)
    const totalTVA = activeSales.reduce((sum, s) => sum + Number(s.totalTVA), 0)

    // Nombre de tickets
    const ticketCount = activeSales.length

    // Quantité totale de produits vendus
    const activeItemsIds = activeSales.map(s => s.id)
    const activeItems = allItems.filter(item => activeItemsIds.includes(item.saleId))
    const totalQuantity = activeItems.reduce((sum, item) => sum + item.quantity, 0)

    // Panier moyen en quantité
    const avgBasketQuantity = ticketCount > 0 ? totalQuantity / ticketCount : 0

    // Panier moyen en valeur
    const avgBasketValue = ticketCount > 0 ? totalTTC / ticketCount : 0

    // Nombre de remises et valeur
    let discountCount = 0
    let totalDiscountValue = 0

    activeSales.forEach(sale => {
      // Remise globale
      if (sale.globalDiscount && Number(sale.globalDiscount) > 0) {
        discountCount += 1
        const discount = Number(sale.globalDiscount)
        if (sale.globalDiscountType === '%') {
          // Calculer la valeur réelle de la remise en %
          totalDiscountValue += (Number(sale.totalTTC) * discount) / (100 - discount)
        } else {
          totalDiscountValue += discount
        }
      }

      // Remises par ligne
      const saleItemsList = allItems.filter(item => item.saleId === sale.id)
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

    // Nombre de retours/annulations
    const returnCount = cancelledSales.length

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
    console.error('Erreur lors de la récupération de la synthèse:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
