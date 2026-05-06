import { db } from '~/server/database/connection'
import { sales, saleItems, stockMovements, products, variations, registers, establishments, closures, productStocks, customers, customerEstablishments, loyaltyVouchers } from '~/server/database/schema'
import { randomBytes } from 'node:crypto'
import { desc, and, eq, sql, inArray, gt, or, isNull } from 'drizzle-orm'
import {
  generateTicketNumber,
  generateTicketHash,
  generateTicketSignature,
  type TicketData,
} from '~/server/utils/nf525'
import { logSaleCreation, logSystemError } from '~/server/utils/audit'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createSaleRequestSchema, type CreateSaleRequestInput } from '~/server/validators/sale.schema'
import { logger } from '~/server/utils/logger'
import { recomputeTotalTTC, validateTotalTTC, recomputeHTandTVA } from '~/server/utils/financialValidation'
import { getActiveLoyaltyConfig, calculatePointsForSale, getCustomerLoyaltyPoints, type LoyaltyConfigData } from '~/server/utils/loyalty'

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
    restockOnReturn?: boolean // Pour les retours : indique si on doit remettre en stock
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
  establishmentId: number
  registerId: number
  loyaltyReward?: {
    type: 'percent_discount' | 'euro_discount' | 'voucher'
    value: number
    pointsToConsume: number
  } | null
  usedVoucherIds?: number[]
}

export default defineEventHandler(async (event) => {
  try {
    const body = await validateBody<CreateSaleRequestInput>(event, createSaleRequestSchema)
    const tenantId = getTenantIdFromEvent(event)

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

    // Pour les échanges (total = 0), on n'exige pas de mode de paiement
    if (Number(body.totals.totalTTC) !== 0 && (!body.payments || body.payments.length === 0)) {
      throw createError({
        statusCode: 400,
        message: 'Mode de paiement manquant',
      })
    }

    if (!body.establishmentId || !body.registerId) {
      throw createError({
        statusCode: 400,
        message: 'Établissement ou caisse manquant',
      })
    }

    // Vérifier la caisse et l'établissement associés au tenant
    const [register] = await db
      .select({
        id: registers.id,
        tenantId: registers.tenantId,
        establishmentId: registers.establishmentId,
        name: registers.name,
        registerNumber: registers.registerNumber,
      })
      .from(registers)
      .where(
        and(
          eq(registers.id, body.registerId),
          eq(registers.tenantId, tenantId),
          eq(registers.isActive, true)
        )
      )
      .limit(1)

    if (!register) {
      throw createError({
        statusCode: 400,
        message: 'Caisse introuvable ou inactive',
      })
    }

    if (register.establishmentId !== body.establishmentId) {
      throw createError({
        statusCode: 400,
        message: 'La caisse sélectionnée n’appartient pas à cet établissement',
      })
    }

    const [establishment] = await db
      .select({
        id: establishments.id,
        name: establishments.name,
        establishmentNumber: establishments.establishmentNumber,
      })
      .from(establishments)
      .where(
        and(
          eq(establishments.id, register.establishmentId),
          eq(establishments.tenantId, tenantId),
          eq(establishments.isActive, true)
        )
      )
      .limit(1)

    if (!establishment) {
      throw createError({
        statusCode: 400,
        message: 'Établissement introuvable ou inactif',
      })
    }

    // Numérotation NF525 stable : établissement.establishment_number + register.register_number
    // Ces valeurs sont assignées immutables à la création (cf. migration 0013) et ne dépendent
    // plus de la position dans une liste filtrée — désactiver un établissement ou une caisse
    // ne décale plus les numéros de ticket.
    const establishmentNumber = establishment.establishmentNumber
    const registerNumber = register.registerNumber

    // ==========================================
    // VÉRIFIER SI LA JOURNÉE EST CLÔTURÉE POUR CETTE CAISSE
    // ==========================================
    const today = new Date().toISOString().slice(0, 10)
    const [todayClosure] = await db
      .select()
      .from(closures)
      .where(
        and(
          eq(closures.tenantId, tenantId),
          eq(closures.closureDate, today),
          eq(closures.registerId, body.registerId)
        )
      )
      .limit(1)

    if (todayClosure) {
      throw createError({
        statusCode: 403,
        message: `La journée du ${today} est déjà clôturée pour cette caisse. Aucune nouvelle vente ne peut être enregistrée.`,
      })
    }

    // ==========================================
    // PRÉPARER LES ITEMS ET VALIDER LES TOTAUX
    // ==========================================

    const parsedItems = body.items.map(item => {
      const unitPriceNum = Number(item.unitPrice)
      const tvaNum = Number(item.tva)
      const quantityNum = Number(item.quantity)

      return {
        productId: item.productId,
        productName: item.productName,
        variation: item.variation || null,
        quantity: quantityNum,
        unitPrice: unitPriceNum,
        discount: Number(item.discount || 0),
        discountType: item.discountType,
        tva: tvaNum,
      }
    })

    // Valider la cohérence des totaux envoyés par le client
    const recomputed = recomputeTotalTTC(parsedItems)
    if (!validateTotalTTC(Number(body.totals.totalTTC), recomputed)) {
      throw createError({
        statusCode: 400,
        message: `Totaux incohérents : déclaré ${body.totals.totalTTC}€, calculé ${recomputed}€`,
      })
    }

    // Q8 — Revalider HT et TVA serveur. Le check TTC seul laissait un attaquant
    // libre de modifier HT/TVA dans le payload (sous-déclaration TVA, fraude).
    const declaredHT = Number(body.totals.totalHT)
    const declaredTVA = Number(body.totals.totalTVA)
    const declaredTTC = Number(body.totals.totalTTC)
    const { totalHT: recomputedHT, totalTVA: recomputedTVA } = recomputeHTandTVA(parsedItems)

    if (!validateTotalTTC(declaredHT, recomputedHT)) {
      throw createError({
        statusCode: 400,
        message: `Total HT incohérent : déclaré ${declaredHT}€, calculé ${recomputedHT}€`,
      })
    }
    if (!validateTotalTTC(declaredTVA, recomputedTVA)) {
      throw createError({
        statusCode: 400,
        message: `Total TVA incohérent : déclaré ${declaredTVA}€, calculé ${recomputedTVA}€`,
      })
    }

    // Cohérence interne du payload : HT + TVA doit = TTC à 1 centime près
    const sumCents = Math.round(declaredHT * 100) + Math.round(declaredTVA * 100)
    const ttcCents = Math.round(declaredTTC * 100)
    if (Math.abs(sumCents - ttcCents) > 1) {
      throw createError({
        statusCode: 400,
        message: `Incohérence : HT (${declaredHT}€) + TVA (${declaredTVA}€) ≠ TTC (${declaredTTC}€)`,
      })
    }

    // ==========================================
    // FIDÉLITÉ : calcul des points à attribuer + validation reward (avant transaction)
    // ==========================================
    // Conditions cumulatives pour attribuer des points :
    // 1. Une config fidélité existe et est activée pour ce tenant
    // 2. La vente est rattachée à un client (customer.id présent)
    // 3. Ce client a opté pour le programme (customers.loyalty_program=true)
    let pointsEarned = 0
    let pointsConsumed = 0
    let voucherToGenerate: { amount: number, expiresAt: Date | null } | null = null
    let loyaltyCfg: LoyaltyConfigData | null = null
    let loyaltyPointsBeforeSale = 0
    let customerOptedIn = false
    let generatedVoucherInfo: { code: string, amount: number, expiresAt: Date | null } | null = null
    if (body.customer?.id) {
      loyaltyCfg = await getActiveLoyaltyConfig(tenantId)
      if (loyaltyCfg) {
        const [customerRow] = await db
          .select({ loyaltyProgram: customers.loyaltyProgram })
          .from(customers)
          .where(and(eq(customers.id, body.customer.id), eq(customers.tenantId, tenantId)))
          .limit(1)
        if (customerRow?.loyaltyProgram) {
          customerOptedIn = true
          loyaltyPointsBeforeSale = await getCustomerLoyaltyPoints(tenantId, body.customer.id, body.establishmentId)
          pointsEarned = calculatePointsForSale(Number(body.totals.totalTTC), loyaltyCfg.pointMode)

          // Validation et application du reward demandé par le client
          // Anti-tampering : on vérifie que reward.type/value correspondent à la config serveur
          if (body.loyaltyReward) {
            const r = body.loyaltyReward
            const matchesConfig = r.type === loyaltyCfg.rewardType
              && Math.abs(r.value - loyaltyCfg.rewardValue) < 0.01
              && r.pointsToConsume === loyaltyCfg.thresholdPoints
            if (matchesConfig && loyaltyPointsBeforeSale >= r.pointsToConsume) {
              pointsConsumed = r.pointsToConsume
              if (r.type === 'voucher') {
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + loyaltyCfg.voucherValidityDays)
                voucherToGenerate = { amount: r.value, expiresAt }
              }
            }
          }
        }
      }
    }

    // ==========================================
    // VOUCHERS UTILISÉS COMME PAIEMENT — validation pré-transaction
    // ==========================================
    // Pour chaque voucherId envoyé : doit appartenir au client, status='active', non expiré.
    // Anti-tampering : on relit le montant en DB (le client a fourni un payment "Bon d'achat #CODE"
    // dont l'amount sera vérifié ici). Tout voucher invalide = refus 400.
    let validatedUsedVouchers: Array<{ id: number, code: string, amount: number }> = []
    if (Array.isArray(body.usedVoucherIds) && body.usedVoucherIds.length > 0) {
      if (!body.customer?.id) {
        throw createError({
          statusCode: 400,
          message: 'Un bon d\'achat ne peut être utilisé que si la vente est rattachée à un client',
        })
      }

      const now = new Date()
      const rows = await db
        .select({
          id: loyaltyVouchers.id,
          code: loyaltyVouchers.code,
          amount: loyaltyVouchers.amount,
          customerId: loyaltyVouchers.customerId,
        })
        .from(loyaltyVouchers)
        .where(
          and(
            eq(loyaltyVouchers.tenantId, tenantId),
            inArray(loyaltyVouchers.id, body.usedVoucherIds),
            eq(loyaltyVouchers.status, 'active'),
            or(isNull(loyaltyVouchers.expiresAt), gt(loyaltyVouchers.expiresAt, now)),
          ),
        )

      if (rows.length !== body.usedVoucherIds.length) {
        throw createError({
          statusCode: 400,
          message: 'Un ou plusieurs bons d\'achat sont invalides (déjà utilisés, expirés ou inexistants)',
        })
      }

      // Vérifier que tous appartiennent bien au client de la vente
      if (rows.some(r => r.customerId !== body.customer!.id)) {
        throw createError({
          statusCode: 400,
          message: 'Un bon d\'achat ne correspond pas au client de la vente',
        })
      }

      validatedUsedVouchers = rows.map(r => ({
        id: r.id,
        code: r.code,
        amount: parseFloat(r.amount),
      }))
    }

    // ==========================================
    // TRANSACTION: NUMÉROTATION + HASH + VENTE + STOCK
    // ==========================================

    const { newSale, stockUpdateLogs } = await db.transaction(async (tx) => {
      // Advisory lock par établissement pour éviter les doublons de séquence
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${establishment.id})`)

      // 1. RÉCUPÉRER LE DERNIER TICKET (CHAÎNAGE par registre)
      const lastSale = await tx
        .select({
          ticketNumber: sales.ticketNumber,
          currentHash: sales.currentHash,
        })
        .from(sales)
        .where(
          and(
            eq(sales.tenantId, tenantId),
            eq(sales.registerId, register.id)
          )
        )
        .orderBy(desc(sales.id))
        .limit(1)

      const previousHash = lastSale.length > 0 ? (lastSale[0]?.currentHash ?? null) : null

      // 2. GÉNÉRER LE NUMÉRO DE TICKET (séquence isolée par establishmentId)
      const [lastTicket] = await tx
        .select({ ticketNumber: sales.ticketNumber })
        .from(sales)
        .where(eq(sales.establishmentId, establishment.id))
        .orderBy(desc(sales.id))
        .limit(1)

      const extractSeq = (num?: string | null) => {
        if (!num) return 0
        const parts = num.split('-')
        const seqPart = parts[parts.length - 1]
        const parsed = Number(seqPart)
        return Number.isFinite(parsed) ? parsed : 0
      }

      const lastSeq = extractSeq(lastTicket?.ticketNumber)
      // Séquence continue par établissement : 1→999999 puis repart à 1
      const sequenceNumber = (lastSeq >= 999999 ? 0 : lastSeq) + 1
      const ticketNumber = generateTicketNumber(sequenceNumber, establishmentNumber, registerNumber)

      // 3. GÉNÉRER LE HASH NF525
      const ticketData: TicketData = {
        ticketNumber,
        saleDate: new Date(),
        totalTTC: Number(body.totals.totalTTC),
        totalHT: Number(body.totals.totalHT),
        totalTVA: Number(body.totals.totalTVA),
        sellerId: body.seller.id,
        establishmentNumber,
        registerNumber,
        globalDiscount: Number(body.globalDiscount?.value || 0),
        globalDiscountType: body.globalDiscount?.type || '€',
        items: parsedItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalTTC: item.quantity * item.unitPrice,
          tva: item.tva,
          discount: item.discount,
          discountType: item.discountType,
        })),
        payments: body.payments,
      }

      const currentHash = generateTicketHash(ticketData, previousHash)

      // 4. GÉNÉRER LA SIGNATURE INFOCERT
      // TODO: Utiliser la vraie clé INFOCERT en production
      const privateKey = process.env.INFOCERT_PRIVATE_KEY
      const signature = generateTicketSignature(currentHash, privateKey)
      // 5.1 Enregistrer la vente
      const [createdSale] = await tx
        .insert(sales)
        .values({
          tenantId,
          ticketNumber,
          saleDate: new Date(),
          totalHT: Number(body.totals.totalHT).toString(),
          totalTVA: Number(body.totals.totalTVA).toString(),
          totalTTC: Number(body.totals.totalTTC).toString(),
          globalDiscount: Number(body.globalDiscount.value || 0).toString(),
          globalDiscountType: body.globalDiscount.type,
          sellerId: body.seller.id,
          customerId: body.customer?.id || null,
          establishmentId: establishment.id,
          registerId: register.id,
          payments: body.payments,
          previousHash,
          currentHash,
          signature,
          status: 'completed',
          pointsEarned,
          pointsConsumed,
        })
        .returning()

      if (!createdSale) {
        throw createError({ statusCode: 500, message: 'Échec de l\'enregistrement de la vente' })
      }

      // 5.2 Enregistrer les lignes de vente
      const saleItemsData = parsedItems.map(item => {
        const totalTTC = item.unitPrice * item.quantity
        const totalHT = totalTTC / (1 + item.tva / 100)
        const tvaRate = Number.isFinite(item.tva) ? item.tva : 0
        const tvaCode = `TVA${tvaRate.toFixed(2)}`

        return {
          tenantId,
          saleId: createdSale.id,
          productId: item.productId,
          productName: item.productName,
          variation: item.variation || null,
          quantity: item.quantity,
          originalPrice: null,
          unitPrice: item.unitPrice.toString(),
          discount: item.discount ? item.discount.toString() : '0',
          discountType: item.discountType || '%',
          tvaRate: tvaRate.toFixed(2),
          tvaCode,
          tva: item.tva.toString(),
          totalHT: totalHT.toFixed(2),
          totalTTC: totalTTC.toFixed(2),
        }
      })

      await tx.insert(saleItems).values(saleItemsData)

      // 5.3 Mettre à jour le stock et enregistrer les mouvements

      // Pré-fetch bulk : 1 SELECT pour tous les stocks nécessaires
      const itemProductIds = body.items.map(i => i.productId)
      const allProductStocks = await tx
        .select()
        .from(productStocks)
        .where(
          and(
            inArray(productStocks.productId, itemProductIds),
            eq(productStocks.establishmentId, establishment.id),
            eq(productStocks.tenantId, tenantId)
          )
        )
      const stockMap = new Map(allProductStocks.map(s => [s.productId, s]))

      // Pré-fetch bulk : 1 SELECT pour toutes les variations par nom (clés non-numériques)
      const variationNamesToLookup = [
        ...new Set(
          body.items
            .map(i => i.variation)
            .filter((v): v is string => !!v && !/^\d+$/.test(v))
        ),
      ]
      const variationNameMap = new Map<string, number>()
      if (variationNamesToLookup.length > 0) {
        const foundVariations = await tx
          .select({ id: variations.id, name: variations.name })
          .from(variations)
          .where(inArray(variations.name, variationNamesToLookup))
        foundVariations.forEach(v => variationNameMap.set(v.name, v.id))
      }

      const stockMovementsData = []
      const stockUpdateLogs: string[] = []

      for (const item of body.items) {
        // Lookup mémoire au lieu d'un SELECT par item
        const productStock = stockMap.get(item.productId)

        if (!productStock) {
          logger.warn({ productId: item.productId, establishmentId: establishment.id }, 'Stock établissement non trouvé, stock non mis à jour')
          continue
        }

        let oldStock = 0
        let newStock = 0

        // Mise à jour du stock selon le type (avec ou sans variation)
        // productStocks.stockByVariation est au format array [{variationId, stock}]
        type VarStock = { variationId: string; stock: number }
        const rawStockByVar = productStock.stockByVariation
        const varStocks: VarStock[] = Array.isArray(rawStockByVar) ? (rawStockByVar as VarStock[]) : []
        let variationKey: string | null = item.variation || null

        // Normaliser la clé de variation : résoudre le nom en ID si nécessaire
        if (variationKey && varStocks.length > 0) {
          // Vérifier si la clé correspond directement à un variationId dans le tableau
          const directMatch = varStocks.some(v => v.variationId === variationKey)
          if (!directMatch) {
            // Essayer comme clé numérique
            const numericKey = Number(variationKey)
            if (Number.isFinite(numericKey) && varStocks.some(v => v.variationId === String(numericKey))) {
              variationKey = String(numericKey)
            } else {
              // Lookup par nom de variation → ID
              const foundVarId = variationNameMap.get(variationKey)
              if (foundVarId !== undefined && varStocks.some(v => v.variationId === String(foundVarId))) {
                variationKey = String(foundVarId)
              } else {
                logger.warn({ variation: variationKey, productId: item.productId }, 'Variation inconnue, stock non mis à jour pour cette ligne')
                variationKey = null
              }
            }
          }
        }

        if (variationKey && varStocks.length > 0) {
          const varEntry = varStocks.find(v => v.variationId === variationKey)
          oldStock = varEntry?.stock || 0
          newStock = oldStock - item.quantity

          // Mettre à jour le stock de la variation dans le tableau
          const updatedVarStocks = varStocks.filter(v => v.variationId !== variationKey)
          updatedVarStocks.push({ variationId: variationKey, stock: newStock })

          // Mettre à jour le stock par variation de l'établissement
          await tx
            .update(productStocks)
            .set({
              stockByVariation: updatedVarStocks,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(productStocks.productId, item.productId),
                eq(productStocks.establishmentId, establishment.id),
                eq(productStocks.tenantId, tenantId)
              )
            )
        } else {
          oldStock = productStock.stock || 0
          newStock = oldStock - item.quantity

          // Mettre à jour le stock principal de l'établissement
          await tx
            .update(productStocks)
            .set({
              stock: newStock,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(productStocks.productId, item.productId),
                eq(productStocks.establishmentId, establishment.id),
                eq(productStocks.tenantId, tenantId)
              )
            )
        }

        // Enregistrer le mouvement de stock avec l'établissement
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
          establishmentId: establishment.id, // Ajout de l'établissement
        })

        stockUpdateLogs.push(`✅ Stock mis à jour pour produit ${item.productId}${item.variation ? ` (${item.variation})` : ''} - Établissement ${establishment.name}: ${oldStock} → ${newStock}`)
      }

      if (stockMovementsData.length > 0) {
        await tx.insert(stockMovements).values(stockMovementsData)
      }

      // 5.4 FIDÉLITÉ : ajuster le compteur (gain - consommation) sur customer_establishments
      // Net = pointsEarned - pointsConsumed. Peut être négatif (cas où conso > gain) :
      // localLoyaltyPoints peut alors devenir négatif sur cet établissement, mais le total
      // cumulé cross-établissement reste correct (somme intacte).
      const pointsDelta = pointsEarned - pointsConsumed
      if (pointsDelta !== 0 && body.customer?.id) {
        const [existingCE] = await tx
          .select({ id: customerEstablishments.id, current: customerEstablishments.localLoyaltyPoints })
          .from(customerEstablishments)
          .where(
            and(
              eq(customerEstablishments.tenantId, tenantId),
              eq(customerEstablishments.customerId, body.customer.id),
              eq(customerEstablishments.establishmentId, establishment.id),
            ),
          )
          .limit(1)

        if (existingCE) {
          await tx
            .update(customerEstablishments)
            .set({
              localLoyaltyPoints: (existingCE.current ?? 0) + pointsDelta,
              updatedAt: new Date(),
            })
            .where(eq(customerEstablishments.id, existingCE.id))
        }
        else {
          await tx
            .insert(customerEstablishments)
            .values({
              tenantId,
              customerId: body.customer.id,
              establishmentId: establishment.id,
              localLoyaltyPoints: pointsDelta,
            })
        }
      }

      // 5.4a-bis FIDÉLITÉ : marquer les vouchers utilisés (validés en pré-transaction)
      // Comme la pré-validation s'est faite hors transaction, il y a une fenêtre théorique
      // pour qu'un voucher soit utilisé ailleurs entre temps. On accepte ce risque (V1 simple) ;
      // en cas de race condition, le voucher restera marqué `used` sur la mauvaise vente —
      // peu probable en environnement single-user-per-customer.
      if (validatedUsedVouchers.length > 0) {
        const nowDate = new Date()
        for (const v of validatedUsedVouchers) {
          await tx
            .update(loyaltyVouchers)
            .set({
              status: 'used',
              usedAt: nowDate,
              usedSaleId: createdSale.id,
            })
            .where(
              and(
                eq(loyaltyVouchers.id, v.id),
                eq(loyaltyVouchers.tenantId, tenantId),
              ),
            )
        }
      }

      // 5.4b FIDÉLITÉ : générer un voucher si demandé (et validé en pré-transaction)
      // On stocke l'ID du voucher généré dans sales.voucherUsedId pour la traçabilité
      // (utilisé à l'annulation de vente pour cancel le voucher).
      if (voucherToGenerate && body.customer?.id) {
        const code = randomBytes(4).toString('hex').toUpperCase() // 8 caractères hex (ex: A3F9C2D1)
        const [createdVoucher] = await tx
          .insert(loyaltyVouchers)
          .values({
            tenantId,
            customerId: body.customer.id,
            code,
            amount: voucherToGenerate.amount.toString(),
            status: 'active',
            expiresAt: voucherToGenerate.expiresAt,
          })
          .returning({ id: loyaltyVouchers.id })

        if (createdVoucher) {
          await tx
            .update(sales)
            .set({ voucherUsedId: createdVoucher.id })
            .where(eq(sales.id, createdSale.id))
          generatedVoucherInfo = {
            code,
            amount: voucherToGenerate.amount,
            expiresAt: voucherToGenerate.expiresAt,
          }
        }
      }

      // 5.5 Log d'audit NF525 complet
      await logSaleCreation({
        tenantId,
        userId: body.seller.id,
        userName: body.seller.name,
        saleId: createdSale.id,
        ticketNumber,
        totalTTC: Number(body.totals.totalTTC),
        itemsCount: body.items.length,
        hash: currentHash,
        signature,
        establishmentId: establishment.id,
        registerId: register.id,
        ipAddress: getRequestIP(event) || null,
      })

      return { newSale: createdSale, saleItemsData, stockUpdateLogs }
    })

    if (stockUpdateLogs.length > 0) {
      logger.info({ updates: stockUpdateLogs.length, establishmentId: establishment.id }, 'Stocks mis à jour pour la vente')
      stockUpdateLogs.forEach(log => logger.debug(log))
    }

    // ==========================================
    // 10. RETOURNER LA RÉPONSE
    // ==========================================

    // Bloc fidélité : null si aucune activité (pas de programme actif ou client non opted-in)
    const loyaltyBlock = customerOptedIn
      ? {
          pointsEarned,
          pointsConsumed,
          pointsTotalAfter: loyaltyPointsBeforeSale + pointsEarned - pointsConsumed,
          generatedVoucher: generatedVoucherInfo,
        }
      : null

    return {
      success: true,
      sale: {
        id: newSale.id,
        ticketNumber: newSale.ticketNumber,
        saleDate: newSale.saleDate,
        totalTTC: newSale.totalTTC,
        hash: newSale.currentHash,
        signature: newSale.signature,
        establishmentId: establishment.id,
        registerId: register.id,
        loyalty: loyaltyBlock,
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la création de la vente')

    await logSystemError({
      tenantId: getTenantIdFromEvent(event),
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      context: 'sales/create',
      ipAddress: getRequestIP(event) || null,
    })

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
