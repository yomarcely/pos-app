import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { validateVariationPayload } from '~/server/utils/validateVariationPayload'

export default defineEventHandler(async (event) => {
  try {
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

    // Préparer les données du produit
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
      stock: manageStock ? (stock ? parseInt(stock) : 0) : 0,
      minStock: minStock ? parseInt(minStock) : 5,
      variationGroupIds: validatedVariations.variationGroupIds,
      stockByVariation: validatedVariations.stockByVariation,
      minStockByVariation: validatedVariations.minStockByVariation,
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
