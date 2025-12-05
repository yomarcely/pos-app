import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { createProductSchema, type CreateProductInput } from '~/server/validators/product.schema'
import { validateBody } from '~/server/utils/validation'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    // Validation avec Zod
    const validatedData = await validateBody<CreateProductInput>(event, createProductSchema)

    // Préparer les données du produit avec tenant_id
    const productData = {
      tenantId,
      ...validatedData,
    }

    // Créer le produit
    const [newProduct] = await db
      .insert(products)
      .values(productData)
      .returning()

    return {
      success: true,
      product: newProduct,
    }
  }
  catch (error: any) {
    console.error('Erreur lors de la création du produit:', error)

    // Gérer les erreurs spécifiques
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Erreur lors de la création du produit',
    })
  }
})
