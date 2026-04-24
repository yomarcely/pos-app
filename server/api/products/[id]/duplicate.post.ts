import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'

/**
 * POST /api/products/:id/duplicate
 * Duplique un produit avec nom suffixé " (copie)" et stock = 0
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, message: 'ID du produit manquant' })
    }

    const productId = parseInt(id)

    // Récupérer le produit source
    const [source] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!source) {
      throw createError({ statusCode: 404, message: 'Produit source non trouvé' })
    }

    // Créer la copie
    const [newProduct] = await db
      .insert(products)
      .values({
        tenantId,
        name: `${source.name} (copie)`,
        barcode: null, // Ne pas copier le code-barres (doit être unique)
        barcodeByVariation: null,
        categoryId: source.categoryId,
        supplierId: source.supplierId,
        brandId: source.brandId,
        supplierCode: source.supplierCode,
        price: source.price,
        purchasePrice: source.purchasePrice,
        tvaId: source.tvaId,
        tva: source.tva,
        stock: 0,
        stockByVariation: null,
        minStock: source.minStock,
        minStockByVariation: source.minStockByVariation,
        variationGroupIds: source.variationGroupIds,
        image: source.image,
        description: source.description,
        isArchived: false,
      })
      .returning()

    if (!newProduct) {
      throw createError({ statusCode: 500, message: 'Échec de la duplication du produit' })
    }

    logger.info({ sourceId: productId, newId: newProduct.id }, 'Produit dupliqué')

    // Q12 — Audit log (création via duplication)
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'product',
      entityId: newProduct.id,
      snapshot: {
        name: newProduct.name,
        duplicatedFrom: productId,
        price: newProduct.price,
      },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Produit dupliqué avec succès',
      product: { id: newProduct.id, name: newProduct.name },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la duplication du produit')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
