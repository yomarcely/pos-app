import { db } from '~/server/database/connection'
import {
  inventoryPreparations,
  inventoryPreparationItems,
  products,
  productStocks,
  establishments,
} from '~/server/database/schema'
import { and, eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { normalizeStockByVariation } from '~/server/utils/productOverrides'

/**
 * GET /api/inventory-preparations/:id
 *
 * Détail d'une préparation : entête + lignes avec nom de produit
 * et stock actuel (pour comparaison avec ce qui a été compté).
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const idParam = getRouterParam(event, 'id')
    const id = idParam ? Number(idParam) : NaN

    if (!id || Number.isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID de préparation manquant ou invalide' })
    }

    const [preparation] = await db
      .select({
        id: inventoryPreparations.id,
        preparationNumber: inventoryPreparations.preparationNumber,
        name: inventoryPreparations.name,
        comment: inventoryPreparations.comment,
        establishmentId: inventoryPreparations.establishmentId,
        establishmentName: establishments.name,
        status: inventoryPreparations.status,
        validatedAt: inventoryPreparations.validatedAt,
        validatedMovementId: inventoryPreparations.validatedMovementId,
        createdAt: inventoryPreparations.createdAt,
        updatedAt: inventoryPreparations.updatedAt,
      })
      .from(inventoryPreparations)
      .leftJoin(establishments, eq(inventoryPreparations.establishmentId, establishments.id))
      .where(and(eq(inventoryPreparations.id, id), eq(inventoryPreparations.tenantId, tenantId)))
      .limit(1)

    if (!preparation) {
      throw createError({ statusCode: 404, message: 'Préparation non trouvée' })
    }

    // Quand la préparation est liée à un établissement, le stock actuel doit
    // être lu depuis productStocks (et non products.stock qui est le stock global).
    const establishmentId = preparation.establishmentId
    type ItemRow = {
      id: number
      productId: number
      productName: string | null
      variation: string | null
      expectedStock: number
      countedStock: number
      currentStock: number | null
      stockByVariation: unknown
    }
    let items: ItemRow[]
    if (establishmentId) {
      items = await db
        .select({
          id: inventoryPreparationItems.id,
          productId: inventoryPreparationItems.productId,
          productName: products.name,
          variation: inventoryPreparationItems.variation,
          expectedStock: inventoryPreparationItems.expectedStock,
          countedStock: inventoryPreparationItems.countedStock,
          currentStock: productStocks.stock,
          stockByVariation: productStocks.stockByVariation,
        })
        .from(inventoryPreparationItems)
        .leftJoin(products, eq(inventoryPreparationItems.productId, products.id))
        .leftJoin(
          productStocks,
          and(
            eq(productStocks.productId, inventoryPreparationItems.productId),
            eq(productStocks.establishmentId, establishmentId),
            eq(productStocks.tenantId, tenantId),
          ),
        )
        .where(
          and(
            eq(inventoryPreparationItems.preparationId, id),
            eq(inventoryPreparationItems.tenantId, tenantId),
          ),
        )
    } else {
      items = await db
        .select({
          id: inventoryPreparationItems.id,
          productId: inventoryPreparationItems.productId,
          productName: products.name,
          variation: inventoryPreparationItems.variation,
          expectedStock: inventoryPreparationItems.expectedStock,
          countedStock: inventoryPreparationItems.countedStock,
          currentStock: products.stock,
          stockByVariation: products.stockByVariation,
        })
        .from(inventoryPreparationItems)
        .leftJoin(products, eq(inventoryPreparationItems.productId, products.id))
        .where(
          and(
            eq(inventoryPreparationItems.preparationId, id),
            eq(inventoryPreparationItems.tenantId, tenantId),
          ),
        )
    }

    const formattedItems = items.map((item) => {
      let currentStock = item.currentStock || 0
      if (item.variation && item.stockByVariation) {
        const map = establishmentId
          ? normalizeStockByVariation(item.stockByVariation)
          : (item.stockByVariation as Record<string, number> | null)
        currentStock = map?.[item.variation] || 0
      }
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName || 'Produit inconnu',
        variation: item.variation,
        expectedStock: item.expectedStock,
        countedStock: item.countedStock,
        currentStock,
      }
    })

    return { success: true, preparation: { ...preparation, items: formattedItems } }
  } catch (error) {
    logger.error({ err: error }, "Erreur lors de la récupération de la préparation")
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur'
    throw createError({ statusCode, message })
  }
})
