import { db } from '~/server/database/connection'
import {
  inventoryPreparations,
  inventoryPreparationItems,
  products,
  productStocks,
  stockMovements,
} from '~/server/database/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { createMovement } from '~/server/utils/createMovement'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import {
  logEntityCreation,
  logEntityUpdate,
  logEntityDeactivation,
} from '~/server/utils/audit'
import { normalizeStockByVariation } from '~/server/utils/productOverrides'
import { z } from 'zod'

const setToZeroItemSchema = z.object({
  productId: z.number().int().positive(),
  variation: z.string().max(100).nullable().optional(),
})

const validateSchema = z.object({
  preparationIds: z.array(z.number().int().positive()).min(1),
  setToZeroItems: z.array(setToZeroItemSchema).optional(),
  archiveProductIds: z.array(z.number().int().positive()).optional(),
})

type ValidateBody = z.infer<typeof validateSchema>

interface CountedLine {
  productId: number
  variation: string | null
  countedStock: number
}

function lineKey(productId: number, variation: string | null): string {
  return `${productId}|${variation ?? ''}`
}

/**
 * POST /api/inventory-preparations/validate
 *
 * Effectue la validation finale d'un ensemble de préparations en :
 *   1. Recalculant le stock courant (concurrent avec les ventes)
 *   2. Créant un mouvement parent type='inventory'
 *   3. Appliquant les deltas (inventoriés) + mises à zéro
 *   4. Archivant les produits demandés (refuse si stock != 0)
 *   5. Marquant les préparations comme validées (lien vers le mouvement)
 *
 * Tout ou rien : si une étape échoue, la transaction est rollback.
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await validateBody<ValidateBody>(event, validateSchema)

    // 1. Charger les préparations + garde-fous (identique à preview)
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

    // 2. Charger les lignes des préparations + détecter conflits
    const lines = await db
      .select({
        preparationId: inventoryPreparationItems.preparationId,
        productId: inventoryPreparationItems.productId,
        variation: inventoryPreparationItems.variation,
        countedStock: inventoryPreparationItems.countedStock,
      })
      .from(inventoryPreparationItems)
      .where(
        and(
          eq(inventoryPreparationItems.tenantId, tenantId),
          inArray(inventoryPreparationItems.preparationId, body.preparationIds),
        ),
      )

    const groupedByKey = new Map<string, typeof lines>()
    for (const line of lines) {
      const key = lineKey(line.productId, line.variation)
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
      throw createError({
        statusCode: 409,
        message: 'Conflit de comptage entre préparations',
        data: { conflicts },
      })
    }

    const consolidated: CountedLine[] = []
    const consolidatedKeys = new Set<string>()
    for (const [key, list] of groupedByKey) {
      consolidatedKeys.add(key)
      consolidated.push({
        productId: list[0]!.productId,
        variation: list[0]!.variation,
        countedStock: list[0]!.countedStock,
      })
    }

    // 3. Sanity-check : setToZeroItems ne doit pas chevaucher les inventoriés
    const setToZero = body.setToZeroItems ?? []
    for (const item of setToZero) {
      if (consolidatedKeys.has(lineKey(item.productId, item.variation ?? null))) {
        throw createError({
          statusCode: 400,
          message: `L'article ${item.productId}/${item.variation || '-'} est à la fois inventorié et marqué pour mise à zéro`,
        })
      }
    }

    // 4. Charger le stock courant de tous les produits affectés
    const affectedProductIds = Array.from(
      new Set([
        ...consolidated.map((c) => c.productId),
        ...setToZero.map((i) => i.productId),
        ...(body.archiveProductIds ?? []),
      ]),
    )

    type ProductWithStock = {
      id: number
      name: string
      stock: number | null
      stockByVariation: Record<string, number> | undefined
    }
    let currentProducts: ProductWithStock[] = []
    if (affectedProductIds.length > 0) {
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
          .where(and(eq(products.tenantId, tenantId), inArray(products.id, affectedProductIds)))
        currentProducts = raw.map((r) => ({
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
          .where(and(eq(products.tenantId, tenantId), inArray(products.id, affectedProductIds)))
        currentProducts = raw.map((r) => ({
          id: r.id,
          name: r.name,
          stock: r.stock,
          stockByVariation: (r.stockByVariation as Record<string, number> | null) ?? undefined,
        }))
      }
    }
    const productsById = new Map(currentProducts.map((p) => [p.id, p]))

    function stockOf(productId: number, variation: string | null): number {
      const product = productsById.get(productId)
      if (!product) return 0
      if (variation && product.stockByVariation) return product.stockByVariation[variation] || 0
      return product.stock || 0
    }

    // 5. Garde-fou archivage : stock doit être à 0 exactement maintenant
    const archiveIds = body.archiveProductIds ?? []
    const archiveErrors: Array<{ productId: number; name: string; currentStock: number }> = []
    for (const pid of archiveIds) {
      const product = productsById.get(pid)
      if (!product) {
        archiveErrors.push({ productId: pid, name: 'Produit inconnu', currentStock: 0 })
        continue
      }
      // Pour produit sans variation : products.stock = 0
      // Pour produit avec variations : tous les stocks de variation doivent être 0
      let total = product.stock || 0
      if (product.stockByVariation) {
        total = Object.values(product.stockByVariation).reduce((s, v) => s + (Number(v) || 0), 0)
      }
      if (total !== 0) {
        archiveErrors.push({ productId: pid, name: product.name, currentStock: total })
      }
    }
    if (archiveErrors.length > 0) {
      throw createError({
        statusCode: 409,
        message: "Certains produits à archiver n'ont plus un stock à 0",
        data: { archiveErrors },
      })
    }

    // 6. Construire la liste finale des lignes de mouvement
    type MovementLine = {
      productId: number
      variation: string | null
      quantityDelta: number
      oldStock: number
      newStock: number
      reason: 'inventory_adjustment'
    }
    const movementLines: MovementLine[] = []

    for (const c of consolidated) {
      const oldStock = stockOf(c.productId, c.variation)
      const delta = c.countedStock - oldStock
      if (delta === 0) continue
      movementLines.push({
        productId: c.productId,
        variation: c.variation,
        quantityDelta: delta,
        oldStock,
        newStock: oldStock + delta,
        reason: 'inventory_adjustment',
      })
    }

    for (const item of setToZero) {
      const variation = item.variation ?? null
      const oldStock = stockOf(item.productId, variation)
      if (oldStock <= 0) continue
      movementLines.push({
        productId: item.productId,
        variation,
        quantityDelta: -oldStock,
        oldStock,
        newStock: 0,
        reason: 'inventory_adjustment',
      })
    }

    // 7. Construire le commentaire du mouvement parent
    const prepNumbers = preparations.map((p) => p.preparationNumber).join(', ')
    const comment = `Validation inventaire (${preparations.length} préparation${preparations.length > 1 ? 's' : ''} : ${prepNumbers})`

    // 8. Transaction principale
    const auth = event.context.auth
    const result = await db.transaction(async (tx) => {
      // 8a. Créer le mouvement parent
      const movement = await createMovement('inventory', comment, undefined, tenantId, {
        establishmentId,
      })

      // 8b. Pour chaque ligne : update products + productStocks + insert stockMovements
      for (const line of movementLines) {
        // products.stock (ou stockByVariation)
        if (line.variation) {
          const [product] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, line.productId), eq(products.tenantId, tenantId)))
            .limit(1)
          if (product) {
            const stockByVar = (product.stockByVariation as Record<string, number>) || {}
            const current = stockByVar[line.variation] || 0
            stockByVar[line.variation] = current + line.quantityDelta
            await tx
              .update(products)
              .set({ stockByVariation: stockByVar, updatedAt: new Date() })
              .where(eq(products.id, line.productId))
          }
        } else {
          await tx
            .update(products)
            .set({
              stock: sql`COALESCE(${products.stock}, 0) + ${line.quantityDelta}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, line.productId))
        }

        // productStocks (par établissement)
        if (establishmentId) {
          const [stockRecord] = await tx
            .select()
            .from(productStocks)
            .where(
              and(
                eq(productStocks.productId, line.productId),
                eq(productStocks.establishmentId, establishmentId),
                eq(productStocks.tenantId, tenantId),
              ),
            )
            .limit(1)
          if (stockRecord) {
            if (line.variation) {
              type VarStock = { variationId: string; stock: number }
              const varStocks: VarStock[] = Array.isArray(stockRecord.stockByVariation)
                ? (stockRecord.stockByVariation as VarStock[])
                : []
              const old = varStocks.find((v) => v.variationId === line.variation)?.stock || 0
              const updated = varStocks.filter((v) => v.variationId !== line.variation)
              updated.push({ variationId: line.variation, stock: old + line.quantityDelta })
              await tx
                .update(productStocks)
                .set({ stockByVariation: updated, updatedAt: new Date() })
                .where(eq(productStocks.id, stockRecord.id))
            } else {
              await tx
                .update(productStocks)
                .set({
                  stock: sql`COALESCE(${productStocks.stock}, 0) + ${line.quantityDelta}`,
                  updatedAt: new Date(),
                })
                .where(eq(productStocks.id, stockRecord.id))
            }
          }
        }

        // stockMovements
        await tx.insert(stockMovements).values({
          tenantId,
          movementId: movement.id,
          productId: line.productId,
          variation: line.variation,
          establishmentId,
          quantity: line.quantityDelta,
          oldStock: line.oldStock,
          newStock: line.newStock,
          reason: line.reason,
          userId: null,
        })
      }

      // 8c. Archiver les produits demandés
      if (archiveIds.length > 0) {
        await tx
          .update(products)
          .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
          .where(
            and(eq(products.tenantId, tenantId), inArray(products.id, archiveIds)),
          )
      }

      // 8d. Marquer les préparations comme validées
      await tx
        .update(inventoryPreparations)
        .set({
          status: 'validated',
          validatedAt: new Date(),
          validatedMovementId: movement.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryPreparations.tenantId, tenantId),
            inArray(inventoryPreparations.id, body.preparationIds),
          ),
        )

      return { movement }
    })

    // 9. Audit (hors transaction, non bloquant)
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'movement',
      entityId: result.movement.id,
      snapshot: {
        movementNumber: result.movement.movementNumber,
        type: 'inventory',
        preparationIds: body.preparationIds.join(','),
        lineCount: movementLines.length,
        archivedCount: archiveIds.length,
      },
      ipAddress: getRequestIP(event) || null,
    })

    for (const prep of preparations) {
      await logEntityUpdate({
        tenantId,
        userId: prep.userId,
        userName: auth?.user?.email || 'Utilisateur',
        entityType: 'inventory_preparation',
        entityId: prep.id,
        changes: { status: 'validated', validatedMovementId: result.movement.id },
        ipAddress: getRequestIP(event) || null,
      })
    }

    for (const pid of archiveIds) {
      await logEntityDeactivation({
        tenantId,
        userId: null,
        userName: auth?.user?.email || 'Utilisateur',
        entityType: 'product',
        entityId: pid,
        ipAddress: getRequestIP(event) || null,
      })
    }

    logger.info(
      {
        movementNumber: result.movement.movementNumber,
        preparationIds: body.preparationIds,
        adjustments: movementLines.length,
        archived: archiveIds.length,
      },
      'Inventaire validé',
    )

    return {
      success: true,
      movement: result.movement,
      adjustmentCount: movementLines.length,
      archivedCount: archiveIds.length,
    }
  } catch (error) {
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500
    if (statusCode >= 500) {
      logger.error({ err: error }, "Erreur lors de la validation d'inventaire")
    }
    throw error
  }
})
