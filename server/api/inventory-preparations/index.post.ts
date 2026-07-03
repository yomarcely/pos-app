import { db } from '~/server/database/connection'
import {
  inventoryPreparations,
  inventoryPreparationItems,
  products,
  productStocks,
} from '~/server/database/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { createInventoryPreparation } from '~/server/utils/createInventoryPreparation'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'
import { normalizeStockByVariation } from '~/server/utils/productOverrides'
import { z } from 'zod'

const itemSchema = z.object({
  productId: z.number().int().positive(),
  variation: z.string().max(100).nullable().optional(),
  countedStock: z.number().int(),
})

const createSchema = z.object({
  name: z.string().max(255).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
  establishmentId: z.number().int().positive().nullable().optional(),
  items: z.array(itemSchema).min(1, 'Au moins un article requis'),
})

type CreateBody = z.infer<typeof createSchema>

/**
 * POST /api/inventory-preparations
 *
 * Crée une préparation d'inventaire (status=draft). Aucun impact stock.
 * expectedStock est figé à la valeur actuelle de products.stock (info historique).
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const body = await validateBody<CreateBody>(event, createSchema)

    // 1. Récupérer les stocks actuels pour les produits concernés
    // Quand un établissement est précisé, on doit lire le stock depuis productStocks
    // (et non products.stock qui est le stock global "legacy"). Cohérent avec
    // /api/products qui applique cette même logique via applyEstablishmentOverrides.
    const productIds = Array.from(new Set(body.items.map((i) => i.productId)))
    const establishmentId = body.establishmentId ?? null

    let rows: Array<{
      id: number
      stock: number | null
      stockByVariation: Record<string, number> | undefined
    }>

    if (establishmentId) {
      const raw = await db
        .select({
          id: products.id,
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
        .where(and(eq(products.tenantId, tenantId), inArray(products.id, productIds)))
      rows = raw.map((r) => ({
        id: r.id,
        stock: r.stock,
        stockByVariation: normalizeStockByVariation(r.stockByVariation),
      }))
    } else {
      const raw = await db
        .select({
          id: products.id,
          stock: products.stock,
          stockByVariation: products.stockByVariation,
        })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), inArray(products.id, productIds)))
      rows = raw.map((r) => ({
        id: r.id,
        stock: r.stock,
        stockByVariation: (r.stockByVariation as Record<string, number> | null) ?? undefined,
      }))
    }

    if (rows.length !== productIds.length) {
      const found = new Set(rows.map((r) => r.id))
      const missing = productIds.filter((id) => !found.has(id))
      throw createError({
        statusCode: 404,
        message: `Produit(s) introuvable(s) : ${missing.join(', ')}`,
      })
    }

    const productsById = new Map(rows.map((r) => [r.id, r]))

    // 2. Transaction : créer la préparation parent + insérer les lignes
    const result = await db.transaction(async (tx) => {
      // `tx` obligatoire : deadlock en mode pooler max=1 sinon (cf. connection.ts).
      const preparation = await createInventoryPreparation(tenantId, {
        name: body.name,
        comment: body.comment,
        establishmentId: body.establishmentId,
      }, tx)

      const rowsToInsert = body.items.map((item) => {
        const product = productsById.get(item.productId)!
        let expectedStock = 0
        if (item.variation && product.stockByVariation) {
          expectedStock = product.stockByVariation[item.variation] || 0
        } else {
          expectedStock = product.stock || 0
        }
        return {
          tenantId,
          preparationId: preparation.id,
          productId: item.productId,
          variation: item.variation || null,
          expectedStock,
          countedStock: item.countedStock,
        }
      })

      const inserted = await tx
        .insert(inventoryPreparationItems)
        .values(rowsToInsert)
        .returning()

      return { preparation, items: inserted }
    })

    // 3. Audit (non bloquant)
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'inventory_preparation',
      entityId: result.preparation.id,
      snapshot: {
        preparationNumber: result.preparation.preparationNumber,
        name: body.name,
        establishmentId: body.establishmentId,
        itemCount: result.items.length,
      },
      ipAddress: getRequestIP(event) || null,
    })

    logger.info(
      {
        preparationNumber: result.preparation.preparationNumber,
        itemCount: result.items.length,
      },
      "Préparation d'inventaire créée",
    )

    return {
      success: true,
      preparation: {
        id: result.preparation.id,
        preparationNumber: result.preparation.preparationNumber,
      },
      itemCount: result.items.length,
    }
  } catch (error) {
    logger.error({ err: error }, "Erreur lors de la création de la préparation d'inventaire")
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500
    const message = statusCode !== 500 && error instanceof Error ? error.message : "Une erreur interne s'est produite"
    throw createError({ statusCode, message })
  }
})
