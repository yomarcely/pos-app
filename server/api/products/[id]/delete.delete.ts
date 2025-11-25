import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Supprimer un produit
 * ==========================================
 *
 * DELETE /api/products/:id/delete
 */

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID du produit manquant',
      })
    }

    const productId = parseInt(id)

    // Vérifier si le produit existe
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product) {
      throw createError({
        statusCode: 404,
        message: 'Produit non trouvé',
      })
    }

    // Supprimer le produit
    await db.delete(products).where(eq(products.id, productId))

    console.log(`✅ Produit supprimé: ${product.name} (ID: ${productId})`)

    return {
      success: true,
      message: 'Produit supprimé avec succès',
      product: {
        id: product.id,
        name: product.name,
      },
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
