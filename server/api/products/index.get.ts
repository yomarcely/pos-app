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
import { parsePaginationQuery, paginationMeta } from '~/server/utils/apiResponse'
import { applyEstablishmentOverrides, type ProductRow } from '~/server/utils/productOverrides'

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

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const search = query.search as string | undefined
    const categoryId = query.categoryId ? Number(query.categoryId) : undefined
    const includeArchived = query.includeArchived === 'true'
    const onlyArchived = query.onlyArchived === 'true'
    const supplierId = query.supplierId ? Number(query.supplierId) : undefined
    const brandId = query.brandId ? Number(query.brandId) : undefined
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined
    const { page, limit, offset } = parsePaginationQuery(event)

    // Construction de la requête avec filtres
    const conditions: SQL[] = []

    // IMPORTANT: Filtrer par tenant_id pour le multi-tenancy
    conditions.push(eq(products.tenantId, tenantId))

    // Filtrer par statut d'archivage
    if (onlyArchived) {
      conditions.push(sql`${products.isArchived} = true`)
    } else if (!includeArchived) {
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
    const selectFields = {
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
      .orderBy(products.name)
      .limit(limit)
      .offset(offset) as unknown as ProductRow[]

    // COUNT séparé pour la pagination — DISTINCT products.id car les JOINs peuvent multiplier
    let countQuery = db
      .select({ total: sql<number>`COUNT(DISTINCT ${products.id})` })
      .from(products) as unknown as {
        innerJoin: (...args: unknown[]) => typeof countQuery
        where: (...args: unknown[]) => Promise<Array<{ total: number }>>
      }

    if (establishmentId) {
      countQuery = countQuery.innerJoin(
        productStocks,
        and(
          eq(productStocks.productId, products.id),
          eq(productStocks.establishmentId, establishmentId),
          eq(productStocks.tenantId, tenantId),
        ),
      )
    }

    const countRow = await countQuery.where(conditions.length > 0 ? and(...conditions) : undefined)
    const total = Number(countRow[0]?.total ?? 0)

    const formattedProducts = allProducts.map(row => applyEstablishmentOverrides(row, establishmentId))

    return {
      success: true,
      products: formattedProducts,
      count: formattedProducts.length,
      meta: {
        pagination: paginationMeta({ page, limit, total }),
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des produits')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
