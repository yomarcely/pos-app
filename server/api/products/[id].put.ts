import { db } from '~/server/database/connection'
import { products, productEstablishments, syncRules, syncGroups } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { updateProductSchema } from '~/server/validators/product.schema'
import { validateBody } from '~/server/utils/validation'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { syncProductToGroup, getGlobalProductFields } from '~/server/utils/sync'

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
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID du produit manquant',
      })
    }

    // Validation avec Zod
    const validatedData = await validateBody(event, updateProductSchema)

    // Filtrer les champs autorisés selon les règles de synchronisation
    let globalFields = validatedData as any
    let localOverrides: any = {}
    let priceOverride: string | null = null
    let purchasePriceOverride: string | null = null

    if (establishmentId) {
      globalFields = await getGlobalProductFields(tenantId, establishmentId, validatedData as any)

      // Identifier les champs bloqués (non synchronisés) qui doivent être stockés localement
      const blockedFields = Object.keys(validatedData as any).filter(key => !(key in globalFields))

      // Stocker TOUS les champs bloqués dans les overrides locaux
      const data = validatedData as any
      if (blockedFields.includes('price') && data.price !== undefined) {
        priceOverride = String(data.price)
      }
      if (blockedFields.includes('purchasePrice') && data.purchasePrice !== undefined) {
        purchasePriceOverride = String(data.purchasePrice)
      }
      if (blockedFields.includes('name') && data.name !== undefined) {
        localOverrides.nameOverride = data.name
      }
      if (blockedFields.includes('description') && data.description !== undefined) {
        localOverrides.descriptionOverride = data.description
      }
      if (blockedFields.includes('barcode') && data.barcode !== undefined) {
        localOverrides.barcodeOverride = data.barcode
      }
      if (blockedFields.includes('supplierId') && data.supplierId !== undefined) {
        localOverrides.supplierIdOverride = data.supplierId
      }
      if (blockedFields.includes('categoryId') && data.categoryId !== undefined) {
        localOverrides.categoryIdOverride = data.categoryId
      }
      if (blockedFields.includes('brandId') && data.brandId !== undefined) {
        localOverrides.brandIdOverride = data.brandId
      }
      if (blockedFields.includes('tva') && data.tva !== undefined) {
        localOverrides.tvaOverride = data.tva
      }
      if (blockedFields.includes('tvaId') && data.tvaId !== undefined) {
        localOverrides.tvaIdOverride = data.tvaId
      }
      if (blockedFields.includes('image') && data.image !== undefined) {
        localOverrides.imageOverride = data.image
      }
      if (blockedFields.includes('variationGroupIds') && data.variationGroupIds !== undefined) {
        localOverrides.variationGroupIdsOverride = data.variationGroupIds
      }

      console.log(`📋 Champs bloqués stockés localement pour établissement ${establishmentId}:`, blockedFields)
    }

    // Si le tenant a un groupe avec syncPriceTtc = false, empêcher la mise à jour globale sans établissement
    const data = validatedData as any
    if (!establishmentId && data.price !== undefined) {
      const hasLocalPriceRules = await db
        .select({ id: syncRules.id })
        .from(syncRules)
        .innerJoin(syncGroups, and(
          eq(syncRules.syncGroupId, syncGroups.id),
          eq(syncGroups.tenantId, tenantId)
        ))
        .where(
          and(
            eq(syncRules.tenantId, tenantId),
            eq(syncRules.entityType, 'product'),
            eq(syncRules.syncPriceTtc, false),
          )
        )
        .limit(1)

      if (hasLocalPriceRules.length > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Prix local : fournissez un establishmentId pour modifier le prix TTC',
        })
      }
    }

    // Mettre à jour UNIQUEMENT les champs autorisés globalement
    const [updatedProduct] = await db
      .update(products)
      .set(globalFields)
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

    // Mettre à jour les overrides locaux (prix + champs non synchronisés) si un établissement est ciblé
    if (establishmentId) {
      const establishmentData: any = {
        priceOverride,
        purchasePriceOverride,
        isAvailable: true,
        ...localOverrides, // Ajouter les overrides des champs non synchronisés
      }

      const updateResult = await db
        .update(productEstablishments)
        .set(establishmentData)
        .where(
          and(
            eq(productEstablishments.productId, parseInt(id)),
            eq(productEstablishments.establishmentId, establishmentId),
            eq(productEstablishments.tenantId, tenantId)
          )
        )
        .returning({ id: productEstablishments.id })

      if (updateResult.length === 0) {
        await db.insert(productEstablishments).values({
          tenantId,
          productId: parseInt(id),
          establishmentId,
          ...establishmentData,
          notes: null,
        })
      }
    }

    // NOTE: Pas besoin de syncProductToGroup() ici car le produit est global
    // Les modifications sont déjà appliquées à tous les établissements via la table products
    // syncProductToGroup() est uniquement utile lors de la CRÉATION pour dupliquer
    // les entrées product_stocks et product_establishments

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
