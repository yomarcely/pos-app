import { db } from '~/server/database/connection'
import { sales, saleItems, stockMovements, products, variations, registers, establishments, closures, productStocks } from '~/server/database/schema'
import { desc, gte, lt, and, eq, like, sql } from 'drizzle-orm'
import {
  generateTicketNumber,
  generateTicketHash,
  generateTicketSignature,
  type TicketData,
} from '~/server/utils/nf525'
import { logSaleCreation } from '~/server/utils/audit'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createSaleRequestSchema, type CreateSaleRequestInput } from '~/server/validators/sale.schema'

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
  establishmentId: number
  registerId: number
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

    if (!body.payments || body.payments.length === 0) {
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

    // Numérotation logique: établissement n°X pour ce tenant, caisse n°Y dans cet établissement
    const tenantEstablishments = await db
      .select({ id: establishments.id })
      .from(establishments)
      .where(
        and(
          eq(establishments.tenantId, tenantId),
          eq(establishments.isActive, true)
        )
      )
      .orderBy(establishments.id)

    const establishmentNumber = tenantEstablishments.findIndex(e => e.id === establishment.id) + 1
    if (establishmentNumber <= 0) {
      throw createError({
        statusCode: 400,
        message: 'Établissement non autorisé pour ce tenant',
      })
    }

    const establishmentRegisters = await db
      .select({ id: registers.id })
      .from(registers)
      .where(
        and(
          eq(registers.establishmentId, establishment.id),
          eq(registers.tenantId, tenantId),
          eq(registers.isActive, true)
        )
      )
      .orderBy(registers.id)

    const registerNumber = establishmentRegisters.findIndex(r => r.id === register.id) + 1
    if (registerNumber <= 0) {
      throw createError({
        statusCode: 400,
        message: 'Caisse non autorisée pour cet établissement',
      })
    }

    // ==========================================
    // VÉRIFIER SI LA JOURNÉE EST CLÔTURÉE POUR CETTE CAISSE
    // ==========================================
    const today = new Date().toISOString().split('T')[0]
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
    // 1. RÉCUPÉRER LE DERNIER TICKET (CHAÎNAGE)
    // ==========================================

    const lastSale = await db
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

    const previousHash = lastSale.length > 0 ? lastSale[0].currentHash : null

    // ==========================================
    // 2. GÉNÉRER LE NUMÉRO DE TICKET
    // ==========================================

    // Compter les tickets du jour pour la séquence (par caisse + date)
    const now = new Date()
    const prefixDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('')

    const ticketPrefix = `${prefixDate}-E${String(establishmentNumber).padStart(2, '0')}-R${String(registerNumber).padStart(2, '0')}-`

    // Récupérer la séquence max existante sur ce préfixe (tous tenants confondus, car contrainte unique globale)
    const [lastTicket] = await db
      .select({ ticketNumber: sales.ticketNumber })
      .from(sales)
      .where(like(sales.ticketNumber, `${ticketPrefix}%`))
      .orderBy(desc(sales.ticketNumber))
      .limit(1)

    const extractSeq = (num?: string | null) => {
      if (!num) return 0
      const parts = num.split('-')
      const seqPart = parts[parts.length - 1]
      const parsed = Number(seqPart)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const lastSeq = extractSeq(lastTicket?.ticketNumber)

    const sequenceNumber = lastSeq + 1
    const ticketNumber = generateTicketNumber(sequenceNumber, establishmentNumber, registerNumber)

    // ==========================================
    // 3. GÉNÉRER LE HASH NF525
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

    // Préparer les données pour le hash NF525 (avec TOUTES les données fiscales)
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
        })
        .returning()

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
      const stockMovementsData = []
      const stockUpdateLogs: string[] = []

      for (const item of body.items) {
        // Récupérer le stock de l'établissement pour ce produit
        const [productStock] = await tx
          .select()
          .from(productStocks)
          .where(
            and(
              eq(productStocks.productId, item.productId),
              eq(productStocks.establishmentId, establishment.id),
              eq(productStocks.tenantId, tenantId)
            )
          )
          .limit(1)

        if (!productStock) {
          console.warn(`Stock établissement non trouvé pour produit ${item.productId} dans l'établissement ${establishment.id}, stock non mis à jour`)
          continue
        }

        let oldStock = 0
        let newStock = 0

        // Mise à jour du stock selon le type (avec ou sans variation)
        const stockByVar = productStock.stockByVariation as Record<string, number> | null
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

          // Mettre à jour le stock par variation de l'établissement
          await tx
            .update(productStocks)
            .set({
              stockByVariation: stockByVar,
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

      // 5.4 Log d'audit NF525 complet
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
        establishmentId: establishment.id,
        registerId: register.id,
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
