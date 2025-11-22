import { db } from '~/server/database/connection'
import { products, categories } from '~/server/database/schema'
import { sql, eq, and } from 'drizzle-orm'

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
 *
 * Retourne la liste des produits avec leur stock et catégorie
 */

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const search = query.search as string | undefined
    const categoryId = query.categoryId ? Number(query.categoryId) : undefined
    const includeArchived = query.includeArchived === 'true'

    // Construction de la requête avec filtres
    const conditions: any[] = []

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

    // Récupérer les produits avec leur catégorie
    const allProducts = await db
      .select({
        id: products.id,
        name: products.name,
        barcode: products.barcode,
        categoryId: products.categoryId,
        categoryName: categories.name,
        price: products.price,
        purchasePrice: products.purchasePrice,
        tva: products.tva,
        stock: products.stock,
        stockByVariation: products.stockByVariation,
        variationGroupIds: products.variationGroupIds,
        image: products.image,
        description: products.description,
        isArchived: products.isArchived,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(products.name)

    // Transformer les données pour correspondre au format attendu par le frontend
    const formattedProducts = allProducts.map(product => ({
      id: product.id,
      name: product.name,
      barcode: product.barcode || '',
      categoryId: product.categoryId,
      categoryName: product.categoryName || null,
      price: parseFloat(product.price),
      purchasePrice: product.purchasePrice ? parseFloat(product.purchasePrice) : undefined,
      tva: parseFloat(product.tva || '20'),
      stock: product.stock || 0,
      stockByVariation: product.stockByVariation as Record<string, number> | undefined,
      variationGroupIds: product.variationGroupIds as string[] | undefined,
      image: product.image || null,
      description: product.description || '',
      isArchived: product.isArchived,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }))

    return {
      success: true,
      products: formattedProducts,
      count: formattedProducts.length,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
