import { db } from '~/server/database/connection'
import { sales, saleItems, stockMovements, products, productEstablishments, variations, registers, establishments, closures, productStocks, customers, customerEstablishments, loyaltyVouchers } from '~/server/database/schema'
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
import { resolvePurchasePriceAtSale } from '~/server/utils/purchasePriceSnapshot'
import { getBusinessDayString } from '~/server/utils/businessDay'
import { findLastUnclosedBusinessDay } from '~/server/utils/closureGuard'
import { findExistingSaleByClientSaleId, buildDuplicateSaleResponse } from '~/server/utils/saleIdempotency'

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
  clientSaleId?: string | null
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

    // ==========================================
    // IDEMPOTENCE (double-submit / rejeu offline)
    // ==========================================
    // Rejeu du même (tenantId, clientSaleId) → retourner la vente existante
    // (duplicate: true) au lieu d'en créer une nouvelle. Cf. server/utils/saleIdempotency.ts
    if (body.clientSaleId) {
      const existingSale = await findExistingSaleByClientSaleId(tenantId, body.clientSaleId)
      if (existingSale) {
        logger.info({ clientSaleId: body.clientSaleId, saleId: existingSale.id }, 'Vente dupliquée détectée (idempotence) — retour de la vente existante')
        return buildDuplicateSaleResponse(existingSale)
      }
    }

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
    const today = getBusinessDayString()
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
    // VÉRIFIER QUE LA DERNIÈRE JOURNÉE ACTIVE EST CLÔTURÉE
    // ==========================================
    // Oubli de clôture la veille → aucune nouvelle vente tant que cette journée
    // n'est pas clôturée, même si des jours sans activité se sont écoulés depuis.
    const lastUnclosedDay = await findLastUnclosedBusinessDay(tenantId, body.registerId)
    if (lastUnclosedDay) {
      throw createError({
        statusCode: 403,
        message: `La journée du ${lastUnclosedDay} n'est pas clôturée pour cette caisse. Clôturez-la (page Synthèse) avant d'enregistrer de nouvelles ventes.`,
        data: { reason: 'previous_day_not_closed', day: lastUnclosedDay },
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
        variationId: item.variationId ?? null,
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
    // VOUCHERS UTILISÉS COMME PAIEMENT — pré-validation (FAST-FAIL UX uniquement)
    // ==========================================
    // Pour chaque voucherId envoyé : doit appartenir au client, status='active', non expiré.
    // Anti-tampering : on relit le montant en DB (le client a fourni un payment "Bon d'achat #CODE"
    // dont l'amount sera vérifié ici). Tout voucher invalide = refus 400.
    // ⚠️ Cette validation est HORS transaction et SANS lock : c'est un simple fast-fail UX.
    // La SOURCE DE VÉRITÉ anti-double-dépense est la re-vérification verrouillée
    // (SELECT ... FOR UPDATE) effectuée DANS la transaction, plus bas (étape 5.4a-bis).
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
      // Pas de persistance ici : la liste validée est reconstruite sous lock dans la transaction.
    }

    // ==========================================
    // TRANSACTION: NUMÉROTATION + HASH + VENTE + STOCK
    // ==========================================

    const { newSale, stockUpdateLogs, stockWarnings } = await db.transaction(async (tx) => {
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
      // NF525 : la date hashée DOIT être strictement identique (à la milliseconde,
      // cf. toISOString dans generateTicketHash) à la saleDate stockée, sinon
      // verify-chain recalcule un hash différent et signale le ticket corrompu.
      const saleDate = new Date()
      const ticketData: TicketData = {
        ticketNumber,
        saleDate,
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
          clientSaleId: body.clientSaleId || null,
          saleDate, // même instant que celui hashé dans ticketData (invariant NF525)
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

      // 5.1 bis Snapshot du prix d'achat (pour marge historique).
      // Priorité : productEstablishments.purchasePriceOverride > products.purchasePrice > null.
      const productIdsForPurchase = parsedItems.map(i => i.productId)

      const basePurchasePrices = await tx
        .select({
          id: products.id,
          purchasePrice: products.purchasePrice,
          variationGroupIds: products.variationGroupIds,
        })
        .from(products)
        .where(
          and(
            inArray(products.id, productIdsForPurchase),
            eq(products.tenantId, tenantId)
          )
        )

      const overridePurchasePrices = await tx
        .select({
          productId: productEstablishments.productId,
          purchasePriceOverride: productEstablishments.purchasePriceOverride,
          variationGroupIdsOverride: productEstablishments.variationGroupIdsOverride,
        })
        .from(productEstablishments)
        .where(
          and(
            inArray(productEstablishments.productId, productIdsForPurchase),
            eq(productEstablishments.establishmentId, establishment.id),
            eq(productEstablishments.tenantId, tenantId)
          )
        )

      const basePurchaseById = new Map(
        basePurchasePrices.map(p => [p.id, p.purchasePrice])
      )
      const overridePurchaseById = new Map(
        overridePurchasePrices.map(p => [p.productId, p.purchasePriceOverride])
      )

      // Variations effectives par produit (override établissement > base, comme
      // productOverrides.ts). Sert à deux invariants de la boucle 5.3 :
      // - un produit à variations ne déstocke JAMAIS le stock global ;
      // - la clé envoyée par la caisse est un NOM de variation (y compris
      //   purement numérique, ex. taille « 38 ») résolu vers l'ID parmi les
      //   variations du produit — jamais interprétée directement comme un ID.
      const overrideVariationIds = new Map<number, unknown>(
        overridePurchasePrices.map(p => [p.productId, p.variationGroupIdsOverride])
      )
      const productVariationIds = new Map<number, number[]>(
        basePurchasePrices.map(p => {
          const override = overrideVariationIds.get(p.id)
          const effective = Array.isArray(override)
            ? override
            : (Array.isArray(p.variationGroupIds) ? p.variationGroupIds : [])
          return [p.id, effective.map(Number).filter(Number.isFinite)]
        })
      )

      // 5.2 Enregistrer les lignes de vente
      const saleItemsData = parsedItems.map(item => {
        const totalTTC = item.unitPrice * item.quantity
        const totalHT = totalTTC / (1 + item.tva / 100)
        const tvaRate = Number.isFinite(item.tva) ? item.tva : 0
        const tvaCode = `TVA${tvaRate.toFixed(2)}`

        const purchasePriceAtSale = resolvePurchasePriceAtSale(
          item.productId,
          basePurchaseById,
          overridePurchaseById
        )

        return {
          tenantId,
          saleId: createdSale.id,
          productId: item.productId,
          productName: item.productName,
          variation: item.variation || null,
          variationId: item.variationId ?? null,
          quantity: item.quantity,
          originalPrice: null,
          unitPrice: item.unitPrice.toString(),
          purchasePriceAtSale,
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

      // Pré-fetch bulk : 1 SELECT pour les noms des variations des produits vendus.
      // La résolution nom → ID se fait parmi les variations DU produit (et non par
      // nom global) : un nom purement numérique (« 38 ») n'est jamais interprété
      // comme un ID de variation, et les collisions de noms entre groupes sont évitées.
      const variationIdsToLookup = [
        ...new Set([...productVariationIds.values()].flat()),
      ]
      const variationNameById = new Map<number, string>()
      if (variationIdsToLookup.length > 0 && body.items.some(i => i.variation || i.variationId != null)) {
        const foundVariations = await tx
          .select({ id: variations.id, name: variations.name })
          .from(variations)
          .where(
            and(
              inArray(variations.id, variationIdsToLookup),
              eq(variations.tenantId, tenantId)
            )
          )
        foundVariations.forEach(v => variationNameById.set(v.id, v.name))
      }

      const stockMovementsData = []
      const stockUpdateLogs: string[] = []
      // Surventes : la vente passe même si le stock devient négatif (stock système
      // souvent faux en retail), mais chaque survente est tracée et remontée au client.
      const stockWarnings: Array<{ productId: number; productName: string; variation: string | null; remainingStock: number }> = []

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

        // Normaliser la clé de variation. Priorité :
        // 1. variationId explicite envoyé par la caisse (clé de stock exacte),
        //    validé contre les variations du produit ou une entrée existante ;
        // 2. résolution du NOM parmi les variations du produit (les noms peuvent
        //    être purement numériques, ex. « 38 » — jamais interprétés comme des IDs) ;
        // 3. clé brute déjà présente dans stockByVariation (legacy).
        // La résolution ne dépend PAS du contenu de stockByVariation : l'entrée
        // manquante est créée à la volée — jamais de fallback sur le stock global.
        const prodVarIds = productVariationIds.get(item.productId) || []
        if (variationKey || item.variationId != null) {
          const explicitId = item.variationId
          if (
            explicitId != null
            && (prodVarIds.includes(explicitId) || varStocks.some(v => v.variationId === String(explicitId)))
          ) {
            variationKey = String(explicitId)
          } else {
            const resolvedId = prodVarIds.find(id => variationNameById.get(id) === variationKey)
            if (resolvedId !== undefined) {
              variationKey = String(resolvedId)
            } else if (!variationKey || !varStocks.some(v => v.variationId === variationKey)) {
              // Ni un variationId valide, ni un nom de variation du produit, ni une
              // clé déjà présente dans le tableau (legacy) : irrésolvable → ne
              // toucher à AUCUN stock (surtout pas au stock global — le produit se
              // vend par variation).
              logger.warn({ variation: variationKey, variationId: explicitId ?? null, productId: item.productId }, 'Variation inconnue, stock non mis à jour pour cette ligne')
              continue
            }
            // sinon : clé brute conservée (entrée existante dans stockByVariation)
          }
        } else if (prodVarIds.length > 0) {
          // Ligne sans variation sur un produit à variations : on refuse de
          // déstocker le stock global (il ne reflète pas les variations).
          logger.warn({ productId: item.productId }, 'Produit à variations vendu sans variation, stock non mis à jour pour cette ligne')
          continue
        }

        if (variationKey) {
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

        const oversell = newStock < 0
        if (oversell) {
          logger.warn(
            { productId: item.productId, variation: item.variation || null, oldStock, quantity: item.quantity },
            'Survente : le stock passe en négatif',
          )
          stockWarnings.push({
            productId: item.productId,
            productName: item.productName,
            variation: item.variation || null,
            remainingStock: newStock,
          })
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
          oversell,
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

      // 5.4a-bis FIDÉLITÉ : verrouiller, re-valider puis marquer les vouchers utilisés.
      // SOURCE DE VÉRITÉ anti-double-dépense. La pré-validation (hors transaction) n'est qu'un
      // fast-fail UX : ici on relit les lignes loyaltyVouchers avec SELECT ... FOR UPDATE pour
      // sérialiser deux ventes concurrentes sur le même bon. La 1re vente acquiert le lock,
      // marque le bon 'used' et commit ; la 2e, bloquée sur le lock, relit ensuite la ligne
      // (READ COMMITTED) avec status='used' → re-validation échoue → rollback + 409.
      if (Array.isArray(body.usedVoucherIds) && body.usedVoucherIds.length > 0) {
        if (!body.customer?.id) {
          throw createError({
            statusCode: 400,
            message: 'Un bon d\'achat ne peut être utilisé que si la vente est rattachée à un client',
          })
        }

        const nowDate = new Date()
        const lockedRows = await tx
          .select({
            id: loyaltyVouchers.id,
            code: loyaltyVouchers.code,
            amount: loyaltyVouchers.amount,
            customerId: loyaltyVouchers.customerId,
            status: loyaltyVouchers.status,
            expiresAt: loyaltyVouchers.expiresAt,
          })
          .from(loyaltyVouchers)
          .where(
            and(
              eq(loyaltyVouchers.tenantId, tenantId),
              inArray(loyaltyVouchers.id, body.usedVoucherIds),
            ),
          )
          .for('update')

        // Re-vérification APRÈS acquisition du lock : status='active', non expiré, bon client.
        const lockedById = new Map(lockedRows.map(r => [r.id, r]))
        const invalidCodes: string[] = []
        for (const voucherId of body.usedVoucherIds) {
          const row = lockedById.get(voucherId)
          if (!row) {
            invalidCodes.push(`#${voucherId}`)
            continue
          }
          const expired = row.expiresAt !== null && row.expiresAt <= nowDate
          const wrongCustomer = row.customerId !== body.customer.id
          if (row.status !== 'active' || expired || wrongCustomer) {
            invalidCodes.push(row.code)
          }
        }

        if (invalidCodes.length > 0) {
          // throw dans la transaction → rollback automatique (la vente n'est pas créée).
          throw createError({
            statusCode: 409,
            message: `Bon(s) d'achat non disponible(s) : ${invalidCodes.join(', ')} (déjà utilisé, expiré ou invalide). Veuillez recharger la page.`,
          })
        }

        for (const row of lockedRows) {
          await tx
            .update(loyaltyVouchers)
            .set({
              status: 'used',
              usedAt: nowDate,
              usedSaleId: createdSale.id,
            })
            .where(
              and(
                eq(loyaltyVouchers.id, row.id),
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

      // 5.5 Log d'audit NF525 complet — atomique avec la vente : on passe `tx`,
      // JAMAIS la connexion globale (deadlock en mode pooler max=1, cf. audit.ts).
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
      }, tx)

      return { newSale: createdSale, saleItemsData, stockUpdateLogs, stockWarnings }
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
      duplicate: false,
      // Articles vendus en survente (stock passé en négatif) — la caisse les affiche
      stockWarnings,
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

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
