import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { updateProductSchema } from '~/server/validators/product.schema'
import { validateBody } from '~/server/utils/validation'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Modifier un produit
 * ==========================================
 *
 * PUT /api/products/:id
 *
 * Modifie un produit existant
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID du produit manquant',
      })
    }

    // Validation avec Zod
    const validatedData = await validateBody(event, updateProductSchema)

    // Mettre à jour le produit - SÉCURITÉ: on filtre par tenantId ET id
    const [updatedProduct] = await db
      .update(products)
      .set(validatedData as any)
      .where(
        and(
          eq(products.id, parseInt(id)),
          eq(products.tenantId, tenantId)
        )
      )
      .returning()

    if (!updatedProduct) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Produit non trouvé',
      })
    }

    return {
      success: true,
      product: updatedProduct,
    }
  } catch (error: any) {
    console.error('Erreur lors de la modification du produit:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Erreur lors de la modification du produit',
    })
  }
})
