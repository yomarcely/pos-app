import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const {
      name,
      description,
      image,
      barcode,
      supplierCode,
      categoryId,
      supplierId,
      brandId,
      price,
      purchasePrice,
      tva,
      manageStock,
      stock,
      hasVariations,
      variationGroupIds,
      stockByVariation,
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

    // Préparer les données du produit
    const productData = {
      name: name.trim(),
      description: description?.trim() || null,
      image: image || null,
      barcode: barcode?.trim() || null,
      supplierCode: supplierCode?.trim() || null,
      categoryId: categoryId ? parseInt(categoryId) : null,
      supplierId: supplierId ? parseInt(supplierId) : null,
      brandId: brandId ? parseInt(brandId) : null,
      price: parseFloat(price),
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      tva: tva ? parseFloat(tva) : 20,
      stock: manageStock ? (stock ? parseInt(stock) : 0) : 0,
      variationGroupIds: hasVariations && variationGroupIds ? variationGroupIds : null,
      stockByVariation: hasVariations && stockByVariation ? stockByVariation : null,
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
