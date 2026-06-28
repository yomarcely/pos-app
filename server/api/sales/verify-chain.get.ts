import { db } from '~/server/database/connection'
import { sales, saleItems } from '~/server/database/schema'
import { and, eq, asc, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { verifyTicketChain, type TicketData } from '~/server/utils/nf525'
import { logChainVerification } from '~/server/utils/audit'
import { logger } from '~/server/utils/logger'
import { z } from 'zod'

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate doit être au format YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate doit être au format YYYY-MM-DD').optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
  registerId: z.coerce.number().int().positive().optional(),
})

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
    const parsed = querySchema.safeParse(getQuery(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        message: `Paramètres invalides : ${parsed.error.issues.map(i => i.message).join(' ; ')}`,
      })
    }

    const { startDate, endDate } = parsed.data
    const registerId = parsed.data.registerId ?? null
    const limit = parsed.data.limit ?? 1000

    logger.info({ tenantId, registerId }, 'Vérification de chaîne')

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
        // L'ordre des items entre dans le hash (join('|')) : on force l'ordre
        // d'insertion (id croissant) pour reproduire l'ordre de création.
        const items = await db
          .select()
          .from(saleItems)
          .where(eq(saleItems.saleId, sale.id))
          .orderBy(asc(saleItems.id))

        return {
          ...sale,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            // unitPrice : hashé en interpolation brute (`${unitPrice}`) à la création.
            // Number() normalise le decimal stocké ("10.50" → 10.5 → "10.5"),
            // exactement comme le number d'origine ("10.5"). Ne pas .toFixed() ici.
            unitPrice: Number(item.unitPrice),
            totalTTC: Number(item.totalTTC),
            // tva : sert au fallback tvaCode du hash (`TVA${tva}`, ex: "TVA20").
            // ⚠️ Ne PAS passer item.tvaCode stocké : il est au format "TVA20.00"
            // (tvaRate.toFixed(2)) alors que le hash de création utilise le
            // fallback "TVA20" (tvaCode absent de ticketData dans create.post.ts).
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
      // saleDate : hashée via toISOString() (précision ms). La colonne PG
      // timestamp conserve les ms, et create.post.ts utilise LA MÊME instance
      // Date pour le hash et l'insert — toute divergence casse la vérification.
      saleDate: sale.saleDate,
      // Totaux : hashés en .toFixed(2) à la création depuis Number(body.totals.X) ;
      // Number(decimal "12.30") → 12.3 → toFixed(2) → "12.30" : round-trip exact.
      totalTTC: Number(sale.totalTTC),
      totalHT: Number(sale.totalHT),
      totalTVA: Number(sale.totalTVA),
      sellerId: sale.sellerId || 0, // Fallback pour les ventes sans vendeur
      // Extraire les numéros d'établissement et de caisse du ticketNumber
      // Format: YYYYMMDD-E{etab}-R{caisse}-NNNNNN
      // Correspond aux colonnes immuables establishmentNumber/registerNumber
      // utilisées à la création, puisque le ticketNumber est construit avec elles.
      establishmentNumber: extractEstablishmentNumber(sale.ticketNumber),
      registerNumber: extractRegisterNumber(sale.ticketNumber),
      // globalDiscount : hashé en interpolation brute (`${value}€`), pas en
      // toFixed — Number() normalise le decimal stocké comme pour unitPrice.
      globalDiscount: Number(sale.globalDiscount || 0),
      globalDiscountType: (sale.globalDiscountType as '%' | '€') || '€',
      items: sale.items,
      payments: (sale.payments as TicketData['payments']) || [],
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

    logger.info(
      { isValid: verificationResult.isValid, brokenLinks: verificationResult.brokenLinks.length },
      `Vérification terminée: ${verificationResult.isValid ? 'CHAÎNE INTACTE' : `${verificationResult.brokenLinks.length} PROBLÈMES DÉTECTÉS`}`
    )

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
    logger.error({ err: error }, 'Erreur lors de la vérification de chaîne')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
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
