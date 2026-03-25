import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * POST /api/products/:id/unarchive
 * Désarchive un produit
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, message: 'ID du produit manquant' })
    }

    const productId = parseInt(id)

    const [product] = await db
      .update(products)
      .set({
        isArchived: false,
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, productId),
          eq(products.tenantId, tenantId)
        )
      )
      .returning()

    if (!product) {
      throw createError({ statusCode: 404, message: 'Produit non trouvé' })
    }

    logger.info({ productId, productName: product.name }, 'Produit désarchivé')

    return {
      success: true,
      message: 'Produit désarchivé avec succès',
      product: { id: product.id, name: product.name },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors du désarchivage du produit')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
