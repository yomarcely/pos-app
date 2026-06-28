import { db } from '~/server/database/connection'
import { products, productStocks } from '~/server/database/schema'
import { createProductSchema, type CreateProductInput } from '~/server/validators/product.schema'
import { validateBody } from '~/server/utils/validation'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { syncProductToGroup } from '~/server/utils/sync'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    // Validation avec Zod
    const validatedData = await validateBody<CreateProductInput>(event, createProductSchema)

    // Préparer les données du produit avec tenant_id.
    // products.stock / stockByVariation sont gelés (source de vérité = productStocks) :
    // on les retire du payload products et on les écrit dans productStocks ci-dessous.
    const { stock, stockByVariation, ...productFields } = validatedData
    const productData = {
      tenantId,
      ...productFields,
    }

    // Créer le produit
    const [newProduct] = await db
      .insert(products)
      .values(productData)
      .returning()

    if (!newProduct) {
      throw createError({ statusCode: 500, message: 'Échec de la création du produit' })
    }

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'product',
      entityId: newProduct.id,
      snapshot: {
        name: newProduct.name,
        barcode: newProduct.barcode,
        price: newProduct.price,
        categoryId: newProduct.categoryId,
        brandId: newProduct.brandId,
        supplierId: newProduct.supplierId,
      },
      ipAddress: getRequestIP(event) || null,
    })

    // Créer le stock initial pour l'établissement source
    if (establishmentId) {
      await db.insert(productStocks).values({
        tenantId,
        productId: newProduct.id,
        establishmentId,
        stock: stock || 0,
        stockByVariation: stockByVariation || [],
        minStock: validatedData.minStock ?? 0,
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
  catch (error) {
    logger.error({ err: error }, 'Erreur lors de la création du produit')

    // Gérer les erreurs spécifiques
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Une erreur interne s'est produite",
    })
  }
})
