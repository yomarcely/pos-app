import { db } from '~/server/database/connection'
import { products, productEstablishments, syncRules, syncGroups } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { updateProductSchema, type UpdateProductInput } from '~/server/validators/product.schema'
import { validateBody } from '~/server/utils/validation'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { getGlobalProductFields, type ProductFields } from '~/server/utils/sync'
import { logger } from '~/server/utils/logger'

/**
 * Type pour les overrides locaux d'un établissement
 */
interface LocalOverrides {
  nameOverride?: string
  descriptionOverride?: string
  barcodeOverride?: string
  supplierIdOverride?: number
  categoryIdOverride?: number
  brandIdOverride?: number
  tvaOverride?: number
  tvaIdOverride?: number
  imageOverride?: string
  variationGroupIdsOverride?: number[]
}

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
    let globalFields: ProductFields = validatedData as ProductFields
    const localOverrides: LocalOverrides = {}
    let priceOverride: string | null = null
    let purchasePriceOverride: string | null = null

    if (establishmentId) {
      globalFields = await getGlobalProductFields(tenantId, establishmentId, validatedData as ProductFields)

      // Identifier les champs bloqués (non synchronisés) qui doivent être stockés localement
      const blockedFields = Object.keys(validatedData).filter(key => !(key in globalFields))

      // Stocker TOUS les champs bloqués dans les overrides locaux
      if (blockedFields.includes('price') && validatedData.price !== undefined) {
        priceOverride = String(validatedData.price)
      }
      if (blockedFields.includes('purchasePrice') && validatedData.purchasePrice !== undefined) {
        purchasePriceOverride = String(validatedData.purchasePrice)
      }
      if (blockedFields.includes('name') && validatedData.name !== undefined) {
        localOverrides.nameOverride = validatedData.name
      }
      if (blockedFields.includes('description') && validatedData.description !== undefined) {
        localOverrides.descriptionOverride = validatedData.description
      }
      if (blockedFields.includes('barcode') && validatedData.barcode !== undefined) {
        localOverrides.barcodeOverride = validatedData.barcode
      }
      if (blockedFields.includes('supplierId') && validatedData.supplierId !== undefined) {
        localOverrides.supplierIdOverride = validatedData.supplierId
      }
      if (blockedFields.includes('categoryId') && validatedData.categoryId !== undefined) {
        localOverrides.categoryIdOverride = validatedData.categoryId
      }
      if (blockedFields.includes('brandId') && validatedData.brandId !== undefined) {
        localOverrides.brandIdOverride = validatedData.brandId
      }
      if (blockedFields.includes('tva') && validatedData.tva !== undefined) {
        localOverrides.tvaOverride = Number(validatedData.tva)
      }
      if (blockedFields.includes('tvaId') && validatedData.tvaId !== undefined) {
        localOverrides.tvaIdOverride = validatedData.tvaId
      }
      if (blockedFields.includes('image') && validatedData.image !== undefined) {
        localOverrides.imageOverride = validatedData.image
      }
      if (blockedFields.includes('variationGroupIds') && validatedData.variationGroupIds !== undefined) {
        localOverrides.variationGroupIdsOverride = validatedData.variationGroupIds
      }

      logger.info({
        establishmentId,
        blockedFields,
      }, 'Champs bloqués stockés localement pour établissement')
    }

    // Si le tenant a un groupe avec syncPriceTtc = false, empêcher la mise à jour globale sans établissement
    if (!establishmentId && validatedData.price !== undefined) {
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
      const establishmentData = {
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
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la modification du produit')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Erreur lors de la modification du produit',
    })
  }
})
