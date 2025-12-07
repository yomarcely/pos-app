import { db } from '~/server/database/connection'
import { sales, saleItems } from '~/server/database/schema'
import { and, eq, asc, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { verifyTicketChain } from '~/server/utils/nf525'
import { logChainVerification } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Vérifier l'intégrité de la chaîne de tickets (Audit NF525)
 * ==========================================
 *
 * GET /api/sales/verify-chain?registerId=1&limit=100
 *
 * Vérifie que la chaîne cryptographique des tickets est intacte.
 * Permet de détecter toute altération frauduleuse des données.
 *
 * Paramètres optionnels:
 * - registerId: Vérifier uniquement une caisse spécifique
 * - limit: Nombre maximum de tickets à vérifier (défaut: 1000)
 * - startDate: Date de début (format YYYY-MM-DD)
 * - endDate: Date de fin (format YYYY-MM-DD)
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)

    const registerIdParam = query.registerId as string | undefined
    const limitParam = query.limit as string | undefined
    const startDate = query.startDate as string | undefined
    const endDate = query.endDate as string | undefined

    const registerId = registerIdParam ? Number(registerIdParam) : null
    const limit = limitParam ? Number(limitParam) : 1000

    console.log(`🔍 Vérification de chaîne pour tenant ${tenantId}${registerId ? ` caisse ${registerId}` : ''}`)

    // ==========================================
    // 1. RÉCUPÉRER LES TICKETS AVEC LEURS ITEMS
    // ==========================================

    const conditions = [eq(sales.tenantId, tenantId)]

    if (registerId) {
      conditions.push(eq(sales.registerId, registerId))
    }

    if (startDate) {
      conditions.push(sql`DATE(${sales.saleDate}) >= ${startDate}`)
    }

    if (endDate) {
      conditions.push(sql`DATE(${sales.saleDate}) <= ${endDate}`)
    }

    // Récupérer les ventes dans l'ordre chronologique
    const salesData = await db
      .select()
      .from(sales)
      .where(and(...conditions))
      .orderBy(asc(sales.id))
      .limit(limit)

    if (salesData.length === 0) {
      return {
        success: true,
        isValid: true,
        message: 'Aucun ticket à vérifier',
        ticketCount: 0,
        brokenLinks: [],
      }
    }

    // Récupérer les items pour chaque vente
    const salesWithItems = await Promise.all(
      salesData.map(async (sale) => {
        const items = await db
          .select()
          .from(saleItems)
          .where(eq(saleItems.saleId, sale.id))

        return {
          ...sale,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalTTC: Number(item.totalTTC),
            tva: Number(item.tva),
            discount: Number(item.discount),
            discountType: item.discountType as '%' | '€',
          })),
        }
      })
    )

    // ==========================================
    // 2. VÉRIFIER LA CHAÎNE CRYPTOGRAPHIQUE
    // ==========================================

    const tickets = salesWithItems.map(sale => ({
      ticketNumber: sale.ticketNumber,
      saleDate: sale.saleDate,
      totalTTC: Number(sale.totalTTC),
      totalHT: Number(sale.totalHT),
      totalTVA: Number(sale.totalTVA),
      sellerId: sale.sellerId || 0, // Fallback pour les ventes sans vendeur
      // Extraire les numéros d'établissement et de caisse du ticketNumber
      // Format: YYYYMMDD-E{etab}-R{caisse}-NNNNNN
      establishmentNumber: extractEstablishmentNumber(sale.ticketNumber),
      registerNumber: extractRegisterNumber(sale.ticketNumber),
      globalDiscount: Number(sale.globalDiscount || 0),
      globalDiscountType: (sale.globalDiscountType as '%' | '€') || '€',
      items: sale.items,
      payments: (sale.payments as any) || [],
      currentHash: sale.currentHash,
      previousHash: sale.previousHash,
    }))

    const verificationResult = verifyTicketChain(tickets)

    // ==========================================
    // 3. ENREGISTRER LA VÉRIFICATION DANS L'AUDIT LOG (NF525)
    // ==========================================
    await logChainVerification({
      tenantId,
      userId: null,
      userName: 'System',
      isValid: verificationResult.isValid,
      ticketCount: tickets.length,
      brokenLinksCount: verificationResult.brokenLinks.length,
      registerId,
      ipAddress: getRequestIP(event) || null,
    })

    // ==========================================
    // 4. RETOURNER LE RÉSULTAT
    // ==========================================

    const statusEmoji = verificationResult.isValid ? '✅' : '❌'
    console.log(`${statusEmoji} Vérification terminée: ${verificationResult.isValid ? 'CHAÎNE INTACTE' : `${verificationResult.brokenLinks.length} PROBLÈMES DÉTECTÉS`}`)

    return {
      success: true,
      isValid: verificationResult.isValid,
      ticketCount: tickets.length,
      brokenLinks: verificationResult.brokenLinks,
      message: verificationResult.isValid
        ? `Chaîne vérifiée avec succès (${tickets.length} tickets)`
        : `⚠️ ${verificationResult.brokenLinks.length} anomalie(s) détectée(s) dans la chaîne`,
      details: {
        firstTicket: tickets[0]?.ticketNumber,
        lastTicket: tickets[tickets.length - 1]?.ticketNumber,
        registerId,
        tenantId,
      },
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de chaîne:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})

/**
 * Extrait le numéro d'établissement du ticket
 * Format: YYYYMMDD-E{etab}-R{caisse}-NNNNNN
 */
function extractEstablishmentNumber(ticketNumber: string): number {
  const match = ticketNumber.match(/-E(\d+)-/)
  return match ? Number(match[1]) : 1
}

/**
 * Extrait le numéro de caisse du ticket
 * Format: YYYYMMDD-E{etab}-R{caisse}-NNNNNN
 */
function extractRegisterNumber(ticketNumber: string): number {
  const match = ticketNumber.match(/-R(\d+)-/)
  return match ? Number(match[1]) : 1
}
