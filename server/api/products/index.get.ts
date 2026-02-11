import { db } from '~/server/database/connection'
import {
  products,
  categories,
  brands,
  suppliers,
  productStocks,
  productEstablishments,
} from '~/server/database/schema'
import { sql, eq, and, type SQL } from 'drizzle-orm'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer tous les produits
 * ==========================================
 *
 * GET /api/products
 *
 * Query params:
 * - search: Recherche par nom ou code-barres
 * - categoryId: Filtrer par catégorie
 * - includeArchived: Inclure les produits archivés (default: false)
 * - establishmentId: Retourner le stock/prix pour un établissement donné
 *
 * Retourne la liste des produits avec leur stock et catégorie
 */

/**
 * Interface pour le résultat de la requête avec champs établissement
 */
interface ProductQueryResult {
  id: number
  name: string
  barcode: string | null
  barcodeByVariation: unknown
  categoryId: number | null
  categoryName: string | null
  supplierId: number | null
  supplierName: string | null
  brandId: number | null
  brandName: string | null
  price: string
  purchasePrice: string | null
  tva: string | null
  stock: number | null
  minStock: number | null
  stockByVariation: unknown
  minStockByVariation: unknown
  variationGroupIds: unknown
  image: string | null
  description: string | null
  isArchived: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
  // Champs spécifiques établissement (optionnels)
  establishmentId?: number | null
  establishmentStock?: number | null
  establishmentStockByVariation?: unknown
  establishmentMinStock?: number | null
  establishmentMinStockByVariation?: unknown
  priceOverride?: string | null
  purchasePriceOverride?: string | null
  nameOverride?: string | null
  descriptionOverride?: string | null
  barcodeOverride?: string | null
  supplierIdOverride?: number | null
  categoryIdOverride?: number | null
  brandIdOverride?: number | null
  tvaOverride?: string | null
  tvaIdOverride?: number | null
  imageOverride?: string | null
  variationGroupIdsOverride?: unknown
  isAvailableLocally?: boolean | null
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const search = query.search as string | undefined
    const categoryId = query.categoryId ? Number(query.categoryId) : undefined
    const includeArchived = query.includeArchived === 'true'
    const supplierId = query.supplierId ? Number(query.supplierId) : undefined
    const brandId = query.brandId ? Number(query.brandId) : undefined
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    // Construction de la requête avec filtres
    const conditions: SQL[] = []

    // IMPORTANT: Filtrer par tenant_id pour le multi-tenancy
    conditions.push(eq(products.tenantId, tenantId))

    // Filtrer les produits non archivés par défaut
    if (!includeArchived) {
      conditions.push(sql`(${products.isArchived} = false OR ${products.isArchived} IS NULL)`)
    }

    // Recherche par nom ou code-barres
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`
      conditions.push(
        sql`(${products.name} ILIKE ${searchTerm} OR ${products.barcode} ILIKE ${searchTerm})`
      )
    }

    // Filtrer par catégorie
    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId))
    }

    if (supplierId) {
      conditions.push(eq(products.supplierId, supplierId))
    }

    if (brandId) {
      conditions.push(eq(products.brandId, brandId))
    }

    // Logique de visibilité des produits par établissement :
    // - Si l'établissement a un stock pour un produit (dans product_stocks), il le voit
    // - Cela permet aux nouveaux établissements de démarrer vides
    // - Et aux établissements désynchro de garder leurs produits

    // Sélection de base
    const selectFields: Record<string, unknown> = {
      id: products.id,
      name: products.name,
      barcode: products.barcode,
      barcodeByVariation: products.barcodeByVariation,
      categoryId: products.categoryId,
      categoryName: categories.name,
      supplierId: products.supplierId,
      supplierName: suppliers.name,
      brandId: products.brandId,
      brandName: brands.name,
      price: products.price,
      purchasePrice: products.purchasePrice,
      tva: products.tva,
      stock: products.stock,
      minStock: products.minStock,
      stockByVariation: products.stockByVariation,
      minStockByVariation: products.minStockByVariation,
      variationGroupIds: products.variationGroupIds,
      image: products.image,
      description: products.description,
      isArchived: products.isArchived,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    }

    // Champs spécifiques à un établissement (stock + prix locaux + overrides)
    if (establishmentId) {
      Object.assign(selectFields, {
        establishmentId: productStocks.establishmentId,
        establishmentStock: productStocks.stock,
        establishmentStockByVariation: productStocks.stockByVariation,
        establishmentMinStock: productStocks.minStock,
        establishmentMinStockByVariation: productStocks.minStockByVariation,
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
        isAvailableLocally: productEstablishments.isAvailable,
      })
    }

    // Construction de la requête
    let queryBuilder = db
      .select(selectFields)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
      .leftJoin(brands, eq(products.brandId, brands.id))

    if (establishmentId) {
      // INNER JOIN pour ne retourner QUE les produits qui ont un stock pour cet établissement
      // Cela permet :
      // - Nouvel établissement = aucun produit (pas de stock)
      // - Établissement désynchro = garde ses produits (a toujours le stock)
      queryBuilder = queryBuilder
        .innerJoin(
          productStocks,
          and(
            eq(productStocks.productId, products.id),
            eq(productStocks.establishmentId, establishmentId),
            eq(productStocks.tenantId, tenantId)
          )
        )
        .leftJoin(
          productEstablishments,
          and(
            eq(productEstablishments.productId, products.id),
            eq(productEstablishments.establishmentId, establishmentId),
            eq(productEstablishments.tenantId, tenantId)
          )
        )
    }

    const allProducts = await queryBuilder
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(products.name) as ProductQueryResult[]

    // Transformer les données pour correspondre au format attendu par le frontend
    const formattedProducts = allProducts.map((product) => ({
      id: product.id,
      // Utiliser les overrides si disponibles pour cet établissement
      name: establishmentId && product.nameOverride
        ? product.nameOverride
        : product.name,
      description: establishmentId && product.descriptionOverride
        ? product.descriptionOverride
        : (product.description || ''),
      barcode: establishmentId && product.barcodeOverride
        ? product.barcodeOverride
        : (product.barcode || ''),
      barcodeByVariation: product.barcodeByVariation as Record<string, string> | undefined,
      categoryId: establishmentId && product.categoryIdOverride
        ? product.categoryIdOverride
        : product.categoryId,
      categoryName: product.categoryName || null,
      supplierId: establishmentId && product.supplierIdOverride
        ? product.supplierIdOverride
        : product.supplierId,
      supplierName: product.supplierName || null,
      brandId: establishmentId && product.brandIdOverride
        ? product.brandIdOverride
        : product.brandId,
      brandName: product.brandName || null,
      image: establishmentId && product.imageOverride
        ? product.imageOverride
        : (product.image || null),
      tva: establishmentId && product.tvaOverride
        ? parseFloat(product.tvaOverride)
        : parseFloat(product.tva || '20'),
      variationGroupIds: establishmentId && product.variationGroupIdsOverride
        ? product.variationGroupIdsOverride as number[]
        : product.variationGroupIds as number[] | undefined,
      price: establishmentId && product.priceOverride
        ? parseFloat(product.priceOverride)
        : parseFloat(product.price),
      purchasePrice: establishmentId && product.purchasePriceOverride
        ? parseFloat(product.purchasePriceOverride)
        : product.purchasePrice ? parseFloat(product.purchasePrice) : undefined,
      priceOverride: establishmentId && product.priceOverride
        ? parseFloat(product.priceOverride)
        : undefined,
      purchasePriceOverride: establishmentId && product.purchasePriceOverride
        ? parseFloat(product.purchasePriceOverride)
        : undefined,
      stock: establishmentId
        ? product.establishmentStock ?? 0
        : product.stock || 0,
      minStock: establishmentId
        ? product.establishmentMinStock ?? 5
        : product.minStock || 5,
      stockByVariation: establishmentId
        ? (product.establishmentStockByVariation as Record<string, number> | undefined)
        : product.stockByVariation as Record<string, number> | undefined,
      minStockByVariation: establishmentId
        ? (product.establishmentMinStockByVariation as Record<string, number> | undefined)
        : product.minStockByVariation as Record<string, number> | undefined,
      isArchived: product.isArchived,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      establishmentId: establishmentId || product.establishmentId || null,
      isAvailable: establishmentId
        ? (product.isAvailableLocally ?? true)
        : true,
    }))

    return {
      success: true,
      products: formattedProducts,
      count: formattedProducts.length,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des produits')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
