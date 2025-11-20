import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { desc, sql } from 'drizzle-orm'

/**
 * ==========================================
 * API: Récupérer tous les produits
 * ==========================================
 *
 * GET /api/products
 *
 * Retourne la liste complète des produits avec leur stock
 */

export default defineEventHandler(async (event) => {
  try {
    // Récupérer tous les produits actifs (non archivés)
    const allProducts = await db
      .select()
      .from(products)
      .where(sql`${products.isArchived} = false OR ${products.isArchived} IS NULL`)
      .orderBy(desc(products.createdAt))

    // Transformer les données pour correspondre au format attendu par le frontend
    const formattedProducts = allProducts.map(product => ({
      id: product.id,
      name: product.name,
      barcode: product.barcode || '',
      price: parseFloat(product.price),
      purchasePrice: product.purchasePrice ? parseFloat(product.purchasePrice) : undefined,
      tva: parseFloat(product.tva || '20'),
      stock: product.stock || 0,
      stockByVariation: product.stockByVariation as Record<string, number> | undefined,
      variationGroupIds: product.variationGroupIds as string[] | undefined,
      image: product.image || '/placeholder-product.png',
      description: product.description || '',
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
