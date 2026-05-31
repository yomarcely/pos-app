import { db } from '~/server/database/connection'
import {
  inventoryPreparations,
  inventoryPreparationItems,
  products,
  productStocks,
} from '~/server/database/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { normalizeStockByVariation } from '~/server/utils/productOverrides'
import { z } from 'zod'

const previewSchema = z.object({
  preparationIds: z.array(z.number().int().positive()).min(1, 'Au moins une préparation requise'),
})

type PreviewBody = z.infer<typeof previewSchema>

/**
 * POST /api/inventory-preparations/preview
 *
 * Consolide les lignes de plusieurs préparations draft et calcule
 * les 3 listings de validation :
 *
 *   1. Articles inventoriés     : présents dans au moins une préparation
 *   2. Non inventoriés stock > 0 : à mettre à zéro éventuellement
 *   3. Non inventoriés stock ≤ 0 : à archiver éventuellement (si stock = 0)
 *
 * Cas d'erreur :
 *   - Préparation inexistante / déjà validée
 *   - Préparations de plusieurs établissements différents (bloque)
 *   - Conflit : même (productId, variation) compté avec valeurs
 *     différentes dans plusieurs préparations → bloque, renvoie 409 + détail
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await validateBody<PreviewBody>(event, previewSchema)

    // 1. Charger les préparations + validations métier
    const preparations = await db
      .select()
      .from(inventoryPreparations)
      .where(
        and(
          eq(inventoryPreparations.tenantId, tenantId),
          inArray(inventoryPreparations.id, body.preparationIds),
        ),
      )

    if (preparations.length !== body.preparationIds.length) {
      const found = new Set(preparations.map((p) => p.id))
      const missing = body.preparationIds.filter((id) => !found.has(id))
      throw createError({
        statusCode: 404,
        message: `Préparation(s) introuvable(s) : ${missing.join(', ')}`,
      })
    }

    const nonDraft = preparations.filter((p) => p.status !== 'draft')
    if (nonDraft.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Préparation(s) déjà validée(s) : ${nonDraft.map((p) => p.preparationNumber).join(', ')}`,
      })
    }

    const establishmentIds = Array.from(
      new Set(preparations.map((p) => p.establishmentId).filter((id): id is number => id !== null)),
    )
    if (establishmentIds.length > 1) {
      throw createError({
        statusCode: 400,
        message: 'Les préparations sélectionnées appartiennent à plusieurs établissements',
      })
    }
    const establishmentId = establishmentIds[0] ?? null

    // 2. Charger toutes les lignes des préparations sélectionnées
    const lines = await db
      .select({
        id: inventoryPreparationItems.id,
        preparationId: inventoryPreparationItems.preparationId,
        productId: inventoryPreparationItems.productId,
        variation: inventoryPreparationItems.variation,
        expectedStock: inventoryPreparationItems.expectedStock,
        countedStock: inventoryPreparationItems.countedStock,
      })
      .from(inventoryPreparationItems)
      .where(
        and(
          eq(inventoryPreparationItems.tenantId, tenantId),
          inArray(inventoryPreparationItems.preparationId, body.preparationIds),
        ),
      )

    // 3. Détecter les conflits : même (productId, variation) avec countedStock divergents
    const groupedByKey = new Map<string, typeof lines>()
    for (const line of lines) {
      const key = `${line.productId}|${line.variation ?? ''}`
      const list = groupedByKey.get(key) ?? []
      list.push(line)
      groupedByKey.set(key, list)
    }

    const prepNumberById = new Map(preparations.map((p) => [p.id, p.preparationNumber]))
    const conflicts: Array<{
      productId: number
      variation: string | null
      counts: Array<{ preparationNumber: string; countedStock: number }>
    }> = []
    for (const [, list] of groupedByKey) {
      const distinct = new Set(list.map((l) => l.countedStock))
      if (distinct.size > 1 && list[0]) {
        conflicts.push({
          productId: list[0].productId,
          variation: list[0].variation,
          counts: list.map((l) => ({
            preparationNumber: prepNumberById.get(l.preparationId) || `#${l.preparationId}`,
            countedStock: l.countedStock,
          })),
        })
      }
    }

    if (conflicts.length > 0) {
      // 409 Conflict : on renvoie aussi le détail pour permettre à l'UI d'afficher
      throw createError({
        statusCode: 409,
        message: 'Conflit de comptage entre préparations',
        data: { conflicts },
      })
    }

    // 4. Consolider : un countedStock unique par (productId, variation)
    const consolidatedKeys = new Set<string>()
    const consolidated: Array<{
      productId: number
      variation: string | null
      countedStock: number
    }> = []
    for (const [key, list] of groupedByKey) {
      consolidatedKeys.add(key)
      consolidated.push({
        productId: list[0]!.productId,
        variation: list[0]!.variation,
        countedStock: list[0]!.countedStock,
      })
    }

    // 5. Charger les produits inventoriés (nom + stock effectif de l'établissement)
    // Quand un établissement est précisé, on lit le stock depuis productStocks
    // (cohérent avec /api/products et l'endpoint POST de création).
    const inventoriedProductIds = Array.from(
      new Set(consolidated.map((c) => c.productId)),
    )
    type ProductWithStock = {
      id: number
      name: string
      stock: number | null
      stockByVariation: Record<string, number> | undefined
    }
    let inventoriedProducts: ProductWithStock[] = []
    if (inventoriedProductIds.length > 0) {
      if (establishmentId) {
        const raw = await db
          .select({
            id: products.id,
            name: products.name,
            stock: productStocks.stock,
            stockByVariation: productStocks.stockByVariation,
          })
          .from(products)
          .innerJoin(
            productStocks,
            and(
              eq(productStocks.productId, products.id),
              eq(productStocks.establishmentId, establishmentId),
              eq(productStocks.tenantId, tenantId),
            ),
          )
          .where(and(eq(products.tenantId, tenantId), inArray(products.id, inventoriedProductIds)))
        inventoriedProducts = raw.map((r) => ({
          id: r.id,
          name: r.name,
          stock: r.stock,
          stockByVariation: normalizeStockByVariation(r.stockByVariation),
        }))
      } else {
        const raw = await db
          .select({
            id: products.id,
            name: products.name,
            stock: products.stock,
            stockByVariation: products.stockByVariation,
          })
          .from(products)
          .where(and(eq(products.tenantId, tenantId), inArray(products.id, inventoriedProductIds)))
        inventoriedProducts = raw.map((r) => ({
          id: r.id,
          name: r.name,
          stock: r.stock,
          stockByVariation: (r.stockByVariation as Record<string, number> | null) ?? undefined,
        }))
      }
    }
    const inventoriedProductsById = new Map(inventoriedProducts.map((p) => [p.id, p]))

    // 6. Tableau 1 : Articles inventoriés
    const tableInventoried = consolidated
      .map((c) => {
        const product = inventoriedProductsById.get(c.productId)
        if (!product) return null
        let currentStock = product.stock || 0
        if (c.variation && product.stockByVariation) {
          currentStock = product.stockByVariation[c.variation] || 0
        }
        return {
          productId: c.productId,
          productName: product.name,
          variation: c.variation,
          currentStock,
          countedStock: c.countedStock,
          delta: c.countedStock - currentStock,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.productName.localeCompare(b.productName))

    // 7. Tableaux 2 et 3 : non inventoriés
    // On charge tous les produits actifs (cohérent avec /api/products?establishmentId).
    // Si establishmentId set : INNER JOIN productStocks (un produit n'apparaît que s'il a
    // un stock pour cet établissement). Sinon : produits du tenant avec stock global.
    type ActiveProductRow = {
      id: number
      name: string
      stock: number | null
      stockByVariation: Record<string, number> | undefined
    }
    let allActiveProducts: ActiveProductRow[]
    if (establishmentId) {
      const raw = await db
        .select({
          id: products.id,
          name: products.name,
          stock: productStocks.stock,
          stockByVariation: productStocks.stockByVariation,
        })
        .from(products)
        .innerJoin(
          productStocks,
          and(
            eq(productStocks.productId, products.id),
            eq(productStocks.establishmentId, establishmentId),
            eq(productStocks.tenantId, tenantId),
          ),
        )
        .where(and(eq(products.tenantId, tenantId), eq(products.isArchived, false)))
      allActiveProducts = raw.map((r) => ({
        id: r.id,
        name: r.name,
        stock: r.stock,
        stockByVariation: normalizeStockByVariation(r.stockByVariation),
      }))
    } else {
      const raw = await db
        .select({
          id: products.id,
          name: products.name,
          stock: products.stock,
          stockByVariation: products.stockByVariation,
        })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.isArchived, false)))
      allActiveProducts = raw.map((r) => ({
        id: r.id,
        name: r.name,
        stock: r.stock,
        stockByVariation: (r.stockByVariation as Record<string, number> | null) ?? undefined,
      }))
    }

    const notInventoriedPositive: Array<{
      productId: number
      productName: string
      variation: string | null
      stock: number
    }> = []
    const notInventoriedNonPositive: Array<{
      productId: number
      productName: string
      variation: string | null
      stock: number
    }> = []

    for (const product of allActiveProducts) {
      const hasVariations = product.stockByVariation &&
        Object.keys(product.stockByVariation).length > 0
      if (hasVariations) {
        for (const [variation, stock] of Object.entries(product.stockByVariation!)) {
          const key = `${product.id}|${variation}`
          if (consolidatedKeys.has(key)) continue
          const s = Number(stock) || 0
          const row = { productId: product.id, productName: product.name, variation, stock: s }
          if (s > 0) notInventoriedPositive.push(row)
          else notInventoriedNonPositive.push(row)
        }
      } else {
        const key = `${product.id}|`
        if (consolidatedKeys.has(key)) continue
        const s = product.stock || 0
        const row = { productId: product.id, productName: product.name, variation: null, stock: s }
        if (s > 0) notInventoriedPositive.push(row)
        else notInventoriedNonPositive.push(row)
      }
    }

    notInventoriedPositive.sort((a, b) => a.productName.localeCompare(b.productName))
    notInventoriedNonPositive.sort((a, b) => a.productName.localeCompare(b.productName))

    logger.info(
      {
        preparationCount: preparations.length,
        inventoried: tableInventoried.length,
        notPositive: notInventoriedPositive.length,
        notNonPositive: notInventoriedNonPositive.length,
      },
      'Aperçu inventaire calculé',
    )

    return {
      success: true,
      establishmentId,
      preparations: preparations.map((p) => ({
        id: p.id,
        preparationNumber: p.preparationNumber,
        name: p.name,
      })),
      inventoried: tableInventoried,
      notInventoriedPositive,
      notInventoriedNonPositive,
    }
  } catch (error) {
    // Ne pas tout logger comme erreur : un conflit est un retour métier normal
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500
    if (statusCode >= 500) {
      logger.error({ err: error }, "Erreur lors du calcul de l'aperçu inventaire")
    }
    throw error
  }
})
