import { db } from '~/server/database/connection'
import { products, productEstablishments } from '~/server/database/schema'
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

    const queryBuilder = db
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
      .where(
        and(
          eq(products.id, parseInt(id)),
          eq(products.tenantId, tenantId)
        )
      )
      .limit(1)

    const [product] = await queryBuilder

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
        name: product.name,
        description: product.description || '',
        image: product.image || null,
        barcode: product.barcode || '',
        barcodeByVariation: product.barcodeByVariation as Record<string, string> | undefined,
        supplierCode: product.supplierCode || '',
        categoryId: product.categoryId,
        supplierId: product.supplierId,
        brandId: product.brandId,
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
        tva: parseFloat(product.tva || '20'),
        tvaId: product.tvaId,
        stock: product.stock || 0,
        minStock: product.minStock || 5,
        variationGroupIds: product.variationGroupIds as number[] | undefined,
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
