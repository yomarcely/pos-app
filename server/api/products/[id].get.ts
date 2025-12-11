import { db } from '~/server/database/connection'
import { products, productEstablishments, productStocks } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Récupérer un produit par ID
 * ==========================================
 *
 * GET /api/products/:id
 *
 * Retourne les détails complets d'un produit
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = getRouterParam(event, 'id')
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID du produit manquant',
      })
    }

    let queryBuilder = db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        image: products.image,
        barcode: products.barcode,
        barcodeByVariation: products.barcodeByVariation,
        supplierCode: products.supplierCode,
        categoryId: products.categoryId,
        supplierId: products.supplierId,
        brandId: products.brandId,
        price: products.price,
        purchasePrice: products.purchasePrice,
        tva: products.tva,
        tvaId: products.tvaId,
        stock: products.stock,
        minStock: products.minStock,
        variationGroupIds: products.variationGroupIds,
        stockByVariation: products.stockByVariation,
        minStockByVariation: products.minStockByVariation,
        priceOverride: productEstablishments.priceOverride,
        purchasePriceOverride: productEstablishments.purchasePriceOverride,
        nameOverride: productEstablishments.nameOverride,
        descriptionOverride: productEstablishments.descriptionOverride,
        barcodeOverride: productEstablishments.barcodeOverride,
        supplierIdOverride: productEstablishments.supplierIdOverride,
        categoryIdOverride: productEstablishments.categoryIdOverride,
        brandIdOverride: productEstablishments.brandIdOverride,
        tvaOverride: productEstablishments.tvaOverride,
        tvaIdOverride: productEstablishments.tvaIdOverride,
        imageOverride: productEstablishments.imageOverride,
        variationGroupIdsOverride: productEstablishments.variationGroupIdsOverride,
        establishmentId: productEstablishments.establishmentId,
      })
      .from(products)
      .leftJoin(
        productEstablishments,
        establishmentId
          ? and(
            eq(productEstablishments.productId, products.id),
            eq(productEstablishments.establishmentId, establishmentId),
            eq(productEstablishments.tenantId, tenantId)
          )
          : and(
            eq(productEstablishments.productId, products.id),
            eq(productEstablishments.tenantId, tenantId)
          )
      )

    // Si un établissement est spécifié, vérifier qu'il a un stock pour ce produit
    // Cela garantit qu'un nouvel établissement ne voit que ses propres produits
    if (establishmentId) {
      queryBuilder = queryBuilder.innerJoin(
        productStocks,
        and(
          eq(productStocks.productId, products.id),
          eq(productStocks.establishmentId, establishmentId),
          eq(productStocks.tenantId, tenantId)
        )
      )
    }

    const [product] = await queryBuilder
      .where(
        and(
          eq(products.id, parseInt(id)),
          eq(products.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!product) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Produit non trouvé',
      })
    }

    return {
      success: true,
      product: {
        id: product.id,
        // Utiliser les overrides si disponibles
        name: product.nameOverride ?? product.name,
        description: product.descriptionOverride ?? product.description ?? '',
        image: product.imageOverride ?? product.image ?? null,
        barcode: product.barcodeOverride ?? product.barcode ?? '',
        barcodeByVariation: product.barcodeByVariation as Record<string, string> | undefined,
        supplierCode: product.supplierCode || '',
        categoryId: product.categoryIdOverride ?? product.categoryId,
        supplierId: product.supplierIdOverride ?? product.supplierId,
        brandId: product.brandIdOverride ?? product.brandId,
        tva: product.tvaOverride ? parseFloat(product.tvaOverride) : parseFloat(product.tva || '20'),
        tvaId: product.tvaIdOverride ?? product.tvaId,
        variationGroupIds: product.variationGroupIdsOverride ?? product.variationGroupIds as number[] | undefined,
        price: parseFloat(product.price),
        purchasePrice: product.purchasePrice ? parseFloat(product.purchasePrice) : null,
        // Overrides pour l'établissement courant s'il existe
        priceOverride: product.priceOverride ? parseFloat(product.priceOverride) : undefined,
        purchasePriceOverride: product.purchasePriceOverride ? parseFloat(product.purchasePriceOverride) : undefined,
        establishmentId: product.establishmentId ?? establishmentId ?? null,
        // Valeur affichée (priorité à l'override)
        effectivePrice: product.priceOverride
          ? parseFloat(product.priceOverride)
          : parseFloat(product.price),
        effectivePurchasePrice: product.purchasePriceOverride
          ? parseFloat(product.purchasePriceOverride)
          : product.purchasePrice ? parseFloat(product.purchasePrice) : null,
        stock: product.stock || 0,
        minStock: product.minStock || 5,
        stockByVariation: product.stockByVariation as Record<string, number> | undefined,
        minStockByVariation: product.minStockByVariation as Record<string, number> | undefined,
      },
    }
  } catch (error: any) {
    console.error('Erreur lors de la récupération du produit:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Erreur lors de la récupération du produit',
    })
  }
})
