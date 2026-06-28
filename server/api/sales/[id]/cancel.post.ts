import { db } from '~/server/database/connection'
import { sales, saleItems, stockMovements, auditLogs, variations, productStocks, customerEstablishments, loyaltyVouchers, registers, establishments, closures } from '~/server/database/schema'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { cancelSaleSchema, type CancelSaleInput } from '~/server/validators/sale.schema'
import {
  generateTicketNumber,
  generateTicketHash,
  generateTicketSignature,
  type TicketData,
} from '~/server/utils/nf525'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Annuler une vente (avoir NF525)
 * ==========================================
 *
 * POST /api/sales/:id/cancel
 *
 * L'annulation NE supprime PAS silencieusement la vente : elle émet un AVOIR =
 * une vente `type='credit_note'` à montants NÉGATIFS qui (P3.2) :
 *  1. prend le prochain numéro de séquence établissement/caisse,
 *  2. entre dans la chaîne de hash (previousHash → currentHash) comme une vente,
 *  3. référence la vente d'origine (originalSaleId),
 *  4. reprend ses lignes en quantités négatives et re-stocke les produits,
 *  5. laisse l'origine status='cancelled' avec un lien vers l'avoir (creditNoteId),
 *  6. est compté (en négatif) dans la clôture et vérifiable par verify-chain.
 */

const extractSeq = (num?: string | null): number => {
  if (!num) return 0
  const parts = num.split('-')
  const seqPart = parts[parts.length - 1]
  const parsed = Number(seqPart)
  return Number.isFinite(parsed) ? parsed : 0
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const auth = event.context.auth
    const userName = auth?.user?.email || auth?.user?.user_metadata?.name || 'Utilisateur'
    const id = Number(getRouterParam(event, 'id'))
    const body = await validateBody<CancelSaleInput>(event, cancelSaleSchema)

    if (!id) {
      throw createError({ statusCode: 400, message: 'ID de vente manquant' })
    }
    if (!body.reason) {
      throw createError({ statusCode: 400, message: 'Raison d\'annulation manquante' })
    }

    // ==========================================
    // 1. RÉCUPÉRER LA VENTE + GARDES
    // ==========================================
    const [sale] = await db
      .select()
      .from(sales)
      .where(and(eq(sales.id, id), eq(sales.tenantId, tenantId)))
      .limit(1)

    if (!sale) {
      throw createError({ statusCode: 404, message: 'Vente non trouvée' })
    }
    if (sale.status === 'cancelled') {
      throw createError({ statusCode: 409, message: 'Cette vente est déjà annulée' })
    }
    if (sale.type === 'credit_note') {
      throw createError({ statusCode: 400, message: 'Un avoir ne peut pas être annulé' })
    }
    if (sale.creditNoteId) {
      throw createError({ statusCode: 409, message: 'Un avoir a déjà été émis pour cette vente' })
    }
    if (!sale.establishmentId || !sale.registerId) {
      throw createError({ statusCode: 400, message: 'Cette vente n\'a pas d\'établissement ou de caisse associé' })
    }

    // Établissement + caisse de l'origine → numérotation NF525 stable (immuable)
    const [register] = await db
      .select({ id: registers.id, registerNumber: registers.registerNumber, establishmentId: registers.establishmentId })
      .from(registers)
      .where(and(eq(registers.id, sale.registerId), eq(registers.tenantId, tenantId)))
      .limit(1)

    if (!register) {
      throw createError({ statusCode: 400, message: 'Caisse de la vente introuvable' })
    }

    const [establishment] = await db
      .select({ id: establishments.id, establishmentNumber: establishments.establishmentNumber })
      .from(establishments)
      .where(and(eq(establishments.id, sale.establishmentId), eq(establishments.tenantId, tenantId)))
      .limit(1)

    if (!establishment) {
      throw createError({ statusCode: 400, message: 'Établissement de la vente introuvable' })
    }

    // Un avoir est daté du jour : il ne peut entrer dans une journée déjà clôturée
    // pour cette caisse (cohérent avec sales/create.post.ts).
    const today = new Date().toISOString().slice(0, 10)
    const [todayClosure] = await db
      .select({ id: closures.id })
      .from(closures)
      .where(and(eq(closures.tenantId, tenantId), eq(closures.closureDate, today), eq(closures.registerId, sale.registerId)))
      .limit(1)

    if (todayClosure) {
      throw createError({
        statusCode: 403,
        message: `La journée du ${today} est déjà clôturée pour cette caisse : impossible d'émettre un avoir.`,
      })
    }

    // ==========================================
    // 2. LIGNES DE LA VENTE D'ORIGINE
    // ==========================================
    const items = await db
      .select()
      .from(saleItems)
      .where(and(eq(saleItems.saleId, id), eq(saleItems.tenantId, tenantId)))

    // Paiements de l'avoir = paiements d'origine négés (remboursement)
    const originalPayments = (sale.payments as Array<{ mode: string; amount: number }>) || []
    const creditPayments = originalPayments.map(p => ({ mode: p.mode, amount: -Number(p.amount) }))

    // ==========================================
    // 3. TRANSACTION : AVOIR CHAÎNÉ + RE-STOCK + FIDÉLITÉ + LIEN ORIGINE
    // ==========================================
    const { creditNote } = await db.transaction(async (tx) => {
      // Advisory lock par établissement (sérialise la numérotation/chaînage)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${establishment.id})`)

      // 3.1 Dernier hash du REGISTRE (chaînage) + prochaine séquence de l'ÉTABLISSEMENT
      const lastSale = await tx
        .select({ currentHash: sales.currentHash })
        .from(sales)
        .where(and(eq(sales.tenantId, tenantId), eq(sales.registerId, register.id)))
        .orderBy(desc(sales.id))
        .limit(1)

      const previousHash = lastSale.length > 0 ? (lastSale[0]?.currentHash ?? null) : null

      const [lastTicket] = await tx
        .select({ ticketNumber: sales.ticketNumber })
        .from(sales)
        .where(eq(sales.establishmentId, establishment.id))
        .orderBy(desc(sales.id))
        .limit(1)

      const lastSeq = extractSeq(lastTicket?.ticketNumber)
      const sequenceNumber = (lastSeq >= 999999 ? 0 : lastSeq) + 1
      const ticketNumber = generateTicketNumber(sequenceNumber, establishment.establishmentNumber, register.registerNumber)

      // 3.2 HASH NF525 — construit EN MIROIR EXACT de create.post.ts mais négatif.
      // saleDate : UNE seule instance, hashée ET stockée (invariant round-trip).
      const saleDate = new Date()
      const ticketData: TicketData = {
        ticketNumber,
        saleDate,
        totalTTC: -Number(sale.totalTTC),
        totalHT: -Number(sale.totalHT),
        totalTVA: -Number(sale.totalTVA),
        sellerId: sale.sellerId ?? 0,
        establishmentNumber: establishment.establishmentNumber,
        registerNumber: register.registerNumber,
        globalDiscount: Number(sale.globalDiscount || 0),
        globalDiscountType: (sale.globalDiscountType as '%' | '€') || '€',
        items: items.map(it => ({
          productId: it.productId,
          quantity: -it.quantity,
          unitPrice: Number(it.unitPrice),
          totalTTC: Number(it.unitPrice) * -it.quantity,
          tva: Number(it.tva),
          discount: Number(it.discount),
          discountType: (it.discountType as '%' | '€') || '%',
        })),
        payments: creditPayments,
      }

      const currentHash = generateTicketHash(ticketData, previousHash)
      const signature = generateTicketSignature(currentHash, process.env.INFOCERT_PRIVATE_KEY)

      // 3.3 Insérer l'AVOIR (montants négatifs, status='completed' pour être compté en clôture)
      const [createdCreditNote] = await tx
        .insert(sales)
        .values({
          tenantId,
          ticketNumber,
          saleDate,
          totalHT: (-Number(sale.totalHT)).toFixed(2),
          totalTVA: (-Number(sale.totalTVA)).toFixed(2),
          totalTTC: (-Number(sale.totalTTC)).toFixed(2),
          globalDiscount: sale.globalDiscount ?? '0',
          globalDiscountType: sale.globalDiscountType ?? '%',
          sellerId: sale.sellerId,
          customerId: sale.customerId,
          establishmentId: establishment.id,
          registerId: register.id,
          payments: creditPayments,
          previousHash,
          currentHash,
          signature,
          status: 'completed',
          type: 'credit_note',
          originalSaleId: sale.id,
        })
        .returning()

      if (!createdCreditNote) {
        throw createError({ statusCode: 500, message: 'Échec de la création de l\'avoir' })
      }

      // 3.4 Lignes de l'avoir : quantités négatives, totaux négatifs (miroir create.post.ts)
      const creditNoteItems = items.map(it => {
        const q = -it.quantity
        const up = Number(it.unitPrice)
        const lineTTC = up * q
        const tvaRate = Number.isFinite(Number(it.tva)) ? Number(it.tva) : 0
        const lineHT = lineTTC / (1 + tvaRate / 100)
        return {
          tenantId,
          saleId: createdCreditNote.id,
          productId: it.productId,
          productName: it.productName,
          variation: it.variation || null,
          quantity: q,
          originalPrice: null,
          unitPrice: up.toString(),
          purchasePriceAtSale: it.purchasePriceAtSale ?? null,
          discount: it.discount ? it.discount.toString() : '0',
          discountType: it.discountType || '%',
          tvaRate: tvaRate.toFixed(2),
          tvaCode: `TVA${tvaRate.toFixed(2)}`,
          tva: (it.tva ?? '0').toString(),
          totalHT: lineHT.toFixed(2),
          totalTTC: lineTTC.toFixed(2),
        }
      })

      if (creditNoteItems.length > 0) {
        await tx.insert(saleItems).values(creditNoteItems)
      }

      // 3.5 RE-STOCKAGE — pré-fetch bulk (1 SELECT, fix N+1) + format tableau [{variationId,stock}]
      const itemProductIds = items.map(i => i.productId)
      const allProductStocks = itemProductIds.length > 0
        ? await tx
            .select()
            .from(productStocks)
            .where(and(
              inArray(productStocks.productId, itemProductIds),
              eq(productStocks.establishmentId, establishment.id),
              eq(productStocks.tenantId, tenantId),
            ))
        : []
      const stockMap = new Map(allProductStocks.map(s => [s.productId, s]))

      // Pré-fetch des variations par nom (clés non-numériques), 1 SELECT
      const variationNamesToLookup = [
        ...new Set(items.map(i => i.variation).filter((v): v is string => !!v && !/^\d+$/.test(v))),
      ]
      const variationNameMap = new Map<string, number>()
      if (variationNamesToLookup.length > 0) {
        const foundVariations = await tx
          .select({ id: variations.id, name: variations.name })
          .from(variations)
          .where(inArray(variations.name, variationNamesToLookup))
        foundVariations.forEach(v => variationNameMap.set(v.name, v.id))
      }

      type VarStock = { variationId: string; stock: number }
      const stockMovementsData = []

      for (const item of items) {
        const productStock = stockMap.get(item.productId)
        if (!productStock) {
          logger.warn({ productId: item.productId, establishmentId: establishment.id }, 'Stock établissement non trouvé, stock non restauré')
          continue
        }

        let oldStock = 0
        let newStock = 0
        const rawStockByVar = productStock.stockByVariation
        const varStocks: VarStock[] = Array.isArray(rawStockByVar) ? (rawStockByVar as VarStock[]) : []
        let variationKey: string | null = item.variation || null

        // Normaliser la clé de variation (nom → id) comme create.post.ts
        if (variationKey && varStocks.length > 0) {
          const directMatch = varStocks.some(v => v.variationId === variationKey)
          if (!directMatch) {
            const numericKey = Number(variationKey)
            if (Number.isFinite(numericKey) && varStocks.some(v => v.variationId === String(numericKey))) {
              variationKey = String(numericKey)
            } else {
              const foundVarId = variationNameMap.get(variationKey)
              if (foundVarId !== undefined && varStocks.some(v => v.variationId === String(foundVarId))) {
                variationKey = String(foundVarId)
              } else {
                logger.warn({ variation: variationKey, productId: item.productId }, 'Variation inconnue, stock non restauré pour cette ligne')
                variationKey = null
              }
            }
          }
        }

        if (variationKey && varStocks.length > 0) {
          const varEntry = varStocks.find(v => v.variationId === variationKey)
          oldStock = varEntry?.stock || 0
          newStock = oldStock + item.quantity // Restaurer : on annule une sortie

          const updatedVarStocks = varStocks.filter(v => v.variationId !== variationKey)
          updatedVarStocks.push({ variationId: variationKey, stock: newStock })

          await tx
            .update(productStocks)
            .set({ stockByVariation: updatedVarStocks, updatedAt: new Date() })
            .where(and(
              eq(productStocks.productId, item.productId),
              eq(productStocks.establishmentId, establishment.id),
              eq(productStocks.tenantId, tenantId),
            ))
        } else {
          oldStock = productStock.stock || 0
          newStock = oldStock + item.quantity

          await tx
            .update(productStocks)
            .set({ stock: newStock, updatedAt: new Date() })
            .where(and(
              eq(productStocks.productId, item.productId),
              eq(productStocks.establishmentId, establishment.id),
              eq(productStocks.tenantId, tenantId),
            ))
        }

        stockMovementsData.push({
          tenantId,
          productId: item.productId,
          variation: item.variation || null,
          quantity: item.quantity, // Positif : remise en stock
          oldStock,
          newStock,
          reason: 'sale_cancellation' as const,
          saleId: createdCreditNote.id,
          userId: null,
          establishmentId: establishment.id,
        })
      }

      if (stockMovementsData.length > 0) {
        await tx.insert(stockMovements).values(stockMovementsData)
      }

      // 3.6 FIDÉLITÉ : restituer les points + cancel/réactiver les vouchers (inverse de la création)
      const pointsDelta = (sale.pointsConsumed ?? 0) - (sale.pointsEarned ?? 0)
      if (pointsDelta !== 0 && sale.customerId) {
        const [existingCE] = await tx
          .select({ id: customerEstablishments.id, current: customerEstablishments.localLoyaltyPoints })
          .from(customerEstablishments)
          .where(and(
            eq(customerEstablishments.tenantId, tenantId),
            eq(customerEstablishments.customerId, sale.customerId),
            eq(customerEstablishments.establishmentId, establishment.id),
          ))
          .limit(1)

        if (existingCE) {
          await tx
            .update(customerEstablishments)
            .set({ localLoyaltyPoints: (existingCE.current ?? 0) + pointsDelta, updatedAt: new Date() })
            .where(eq(customerEstablishments.id, existingCE.id))
        } else {
          await tx
            .insert(customerEstablishments)
            .values({
              tenantId,
              customerId: sale.customerId,
              establishmentId: establishment.id,
              localLoyaltyPoints: pointsDelta,
            })
        }
      }

      if (sale.voucherUsedId) {
        // Voucher généré par cette vente : cancel pour empêcher toute utilisation future
        await tx
          .update(loyaltyVouchers)
          .set({ status: 'cancelled' })
          .where(and(eq(loyaltyVouchers.id, sale.voucherUsedId), eq(loyaltyVouchers.tenantId, tenantId)))
      }

      // Vouchers UTILISÉS comme paiement sur cette vente → réactiver pour utilisation future
      await tx
        .update(loyaltyVouchers)
        .set({ status: 'active', usedAt: null, usedSaleId: null })
        .where(and(
          eq(loyaltyVouchers.usedSaleId, id),
          eq(loyaltyVouchers.tenantId, tenantId),
          eq(loyaltyVouchers.status, 'used'),
        ))

      // 3.7 Marquer la vente d'origine annulée + lien vers l'avoir
      await tx
        .update(sales)
        .set({
          status: 'cancelled',
          cancellationReason: body.reason,
          cancelledAt: new Date(),
          creditNoteId: createdCreditNote.id,
          updatedAt: new Date(),
        })
        .where(and(eq(sales.id, id), eq(sales.tenantId, tenantId)))

      // 3.8 Audit log NF525
      await tx.insert(auditLogs).values({
        tenantId,
        userId: null,
        userName,
        entityType: 'sale',
        entityId: id,
        action: 'delete',
        changes: {
          ticketNumber: sale.ticketNumber,
          totalTTC: Number(sale.totalTTC),
          reason: body.reason,
          status: 'cancelled',
          itemsCount: items.length,
          creditNote: {
            id: createdCreditNote.id,
            ticketNumber,
            totalTTC: Number(createdCreditNote.totalTTC),
            currentHash,
          },
          loyalty: {
            pointsEarnedReversed: sale.pointsEarned ?? 0,
            pointsConsumedRestored: sale.pointsConsumed ?? 0,
            voucherCancelledId: sale.voucherUsedId,
          },
        },
        metadata: {
          originalSaleDate: sale.saleDate,
          cancelledAt: new Date(),
          stockRestored: true,
          creditNoteId: createdCreditNote.id,
        },
        ipAddress: getRequestIP(event) || null,
      })

      return { creditNote: createdCreditNote }
    })

    logger.info(
      { saleId: id, ticketNumber: sale.ticketNumber, creditNoteId: creditNote.id, creditNoteTicket: creditNote.ticketNumber },
      'Vente annulée : avoir NF525 émis et chaîné',
    )

    return {
      success: true,
      message: 'Vente annulée : avoir émis, chaîné et stocks restaurés',
      originalSale: {
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        status: 'cancelled',
        creditNoteId: creditNote.id,
      },
      creditNote: {
        id: creditNote.id,
        ticketNumber: creditNote.ticketNumber,
        totalTTC: creditNote.totalTTC,
        hash: creditNote.currentHash,
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de l\'annulation de la vente')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({ statusCode: 500, message: "Une erreur interne s'est produite" })
  }
})
