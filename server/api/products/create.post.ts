import { db } from '~/server/database/connection'
import { products, productStocks } from '~/server/database/schema'
import { createProductSchema, type CreateProductInput } from '~/server/validators/product.schema'
import { validateBody } from '~/server/utils/validation'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { syncProductToGroup } from '~/server/utils/sync'
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

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

    // Créer le stock initial pour l'établissement source
    if (establishmentId) {
      await db.insert(productStocks).values({
        tenantId,
        productId: newProduct.id,
        establishmentId,
        stock: validatedData.stock || 0,
        stockByVariation: validatedData.stockByVariation || [],
        minStock: validatedData.minStock || 0,
      })
      logger.info({ productId: newProduct.id, establishmentId }, 'Stock créé pour le produit')
    }

    // Synchroniser le produit vers les autres établissements du groupe si un establishmentId est fourni
    if (establishmentId) {
      try {
        await syncProductToGroup(tenantId, newProduct.id, establishmentId)
        logger.info({ productId: newProduct.id, establishmentId }, 'Produit synchronisé vers les autres établissements')
      } catch (syncError) {
        logger.warn({ err: syncError, productId: newProduct.id }, 'Erreur lors de la synchronisation du produit')
        // On ne bloque pas la création, juste un warning
      }
    }

    return {
      success: true,
      product: newProduct,
    }
  }
  catch (error: any) {
    logger.error({ err: error }, 'Erreur lors de la création du produit')

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
