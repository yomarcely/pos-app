import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Supprimer un produit
 * ==========================================
 *
 * DELETE /api/products/:id/delete
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
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
      .where(
        and(
          eq(products.id, productId),
          eq(products.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!product) {
      throw createError({
        statusCode: 404,
        message: 'Produit non trouvé',
      })
    }

    // Supprimer le produit
    await db.delete(products).where(
      and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      )
    )

    logger.info({
      productId,
      productName: product.name,
    }, 'Produit supprimé')

    return {
      success: true,
      message: 'Produit supprimé avec succès',
      product: {
        id: product.id,
        name: product.name,
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression du produit')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
