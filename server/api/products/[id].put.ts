import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import { validateVariationPayload } from '~/server/utils/validateVariationPayload'

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
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID du produit manquant',
      })
    }

    const body = await readBody(event)
    const {
      name,
      description,
      image,
      barcode,
      barcodeByVariation,
      supplierCode,
      categoryId,
      supplierId,
      brandId,
      price,
      purchasePrice,
      tva,
      manageStock,
      stock,
      minStock,
      hasVariations,
      variationGroupIds,
      stockByVariation,
      minStockByVariation,
    } = body

    // Validation
    if (!name || !name.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le nom du produit est requis',
      })
    }

    if (!price || parseFloat(price) <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le prix de vente est requis et doit être supérieur à 0',
      })
    }

    const validatedVariations = validateVariationPayload({
      hasVariations,
      variationGroupIds,
      stockByVariation,
      minStockByVariation,
    })

    // Préparer les données du produit (sans toucher au stock)
    const productData = {
      name: name.trim(),
      description: description?.trim() || null,
      image: image || null,
      barcode: barcode?.trim() || null,
      barcodeByVariation: hasVariations && barcodeByVariation ? barcodeByVariation : null,
      supplierCode: supplierCode?.trim() || null,
      categoryId: categoryId ? parseInt(categoryId) : null,
      supplierId: supplierId ? parseInt(supplierId) : null,
      brandId: brandId ? parseInt(brandId) : null,
      price: parseFloat(price).toString(),
      purchasePrice: purchasePrice ? parseFloat(purchasePrice).toString() : null,
      tva: tva ? parseFloat(tva).toString() : '20',
      minStock: minStock !== undefined ? parseInt(minStock) : undefined,
      variationGroupIds: validatedVariations.variationGroupIds,
      stockByVariation: validatedVariations.stockByVariation,
      minStockByVariation: validatedVariations.minStockByVariation,
      // Note: stock n'est PAS modifié ici, il est géré uniquement via l'API de gestion de stock
    }

    // Mettre à jour le produit
    const [updatedProduct] = await db
      .update(products)
      .set(productData)
      .where(eq(products.id, parseInt(id)))
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
