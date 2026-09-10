import { db } from '~/server/database/connection'
import { sales, saleItems } from '~/server/database/schema'
import { and, eq, asc, gte, lt, sql } from 'drizzle-orm'
import { verifyTicketChain, type TicketData } from '~/server/utils/nf525'

/**
 * ==========================================
 * Vérification de chaîne NF525 — logique partagée (A5)
 * ==========================================
 *
 * Extrait tel quel de `server/api/sales/verify-chain.get.ts` pour être
 * réutilisable hors requête utilisateur (contrôle planifié
 * `/api/internal/verify-chains`). AUCUN changement de comportement : mêmes
 * requêtes, même ordre, mêmes conversions de types — les commentaires
 * d'origine sur les pièges de round-trip sont conservés à l'identique.
 *
 * Ce module ne journalise rien et ne touche pas à l'audit trail : l'appelant
 * reste maître de `logChainVerification` et de la forme de sa réponse.
 */

export interface VerifyChainOptions {
  /** Restreint à une caisse. `null` / absent = toutes les caisses du tenant. */
  registerId?: number | null
  /**
   * Borne basse incluse, `YYYY-MM-DD`, comparée sur `DATE(saleDate)` — donc dans
   * le fuseau de la colonne (UTC), PAS dans le fuseau métier. Conservé tel quel
   * pour l'endpoint utilisateur historique ; préférer `from`/`to` pour un jour
   * métier (cf. server/utils/businessDay.ts).
   */
  startDate?: string
  /** Borne haute incluse, `YYYY-MM-DD` (même réserve de fuseau que `startDate`). */
  endDate?: string
  /** Borne basse incluse sur `saleDate` (instant UTC). Ancrée fuseau métier par l'appelant. */
  from?: Date
  /** Borne haute EXCLUE sur `saleDate` (intervalle semi-ouvert, cf. getBusinessDayBounds). */
  to?: Date
  /** Nombre maximum de tickets chargés (défaut 1000, comme l'endpoint public). */
  limit?: number
}

export interface VerifyChainOutcome {
  isValid: boolean
  ticketCount: number
  brokenLinks: ReturnType<typeof verifyTicketChain>['brokenLinks']
  firstTicket?: string
  lastTicket?: string
}

const DEFAULT_LIMIT = 1000

/**
 * Charge les tickets d'un tenant et vérifie l'intégrité de la chaîne.
 *
 * Chaîne vide → `{ isValid: true, ticketCount: 0, brokenLinks: [] }` : l'appelant
 * distingue ce cas par `ticketCount === 0` (l'endpoint public n'écrit alors pas
 * d'audit log — comportement historique à préserver).
 */
export async function verifyChainForTenant(
  tenantId: string,
  options: VerifyChainOptions = {},
): Promise<VerifyChainOutcome> {
  const registerId = options.registerId ?? null
  const limit = options.limit ?? DEFAULT_LIMIT

  // ==========================================
  // 1. RÉCUPÉRER LES TICKETS AVEC LEURS ITEMS
  // ==========================================

  const conditions = [eq(sales.tenantId, tenantId)]

  if (registerId) {
    conditions.push(eq(sales.registerId, registerId))
  }

  if (options.startDate) {
    conditions.push(sql`DATE(${sales.saleDate}) >= ${options.startDate}`)
  }

  if (options.endDate) {
    conditions.push(sql`DATE(${sales.saleDate}) <= ${options.endDate}`)
  }

  // Bornes instant (jour métier) : semi-ouvert `gte(from)` / `lt(to)`.
  if (options.from) {
    conditions.push(gte(sales.saleDate, options.from))
  }

  if (options.to) {
    conditions.push(lt(sales.saleDate, options.to))
  }

  // Récupérer les ventes dans l'ordre chronologique
  const salesData = await db
    .select()
    .from(sales)
    .where(and(...conditions))
    .orderBy(asc(sales.id))
    .limit(limit)

  if (salesData.length === 0) {
    return { isValid: true, ticketCount: 0, brokenLinks: [] }
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

  return {
    isValid: verificationResult.isValid,
    ticketCount: tickets.length,
    brokenLinks: verificationResult.brokenLinks,
    firstTicket: tickets[0]?.ticketNumber,
    lastTicket: tickets[tickets.length - 1]?.ticketNumber,
  }
}

/**
 * Extrait le numéro d'établissement du ticket
 * Format: YYYYMMDD-E{etab}-R{caisse}-NNNNNN
 */
export function extractEstablishmentNumber(ticketNumber: string): number {
  const match = ticketNumber.match(/-E(\d+)-/)
  return match ? Number(match[1]) : 1
}

/**
 * Extrait le numéro de caisse du ticket
 * Format: YYYYMMDD-E{etab}-R{caisse}-NNNNNN
 */
export function extractRegisterNumber(ticketNumber: string): number {
  const match = ticketNumber.match(/-R(\d+)-/)
  return match ? Number(match[1]) : 1
}
