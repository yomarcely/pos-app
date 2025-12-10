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

    // Si un établissement est fourni, isoler le prix en override local, mais mettre à jour les autres champs globaux
    const { price, purchasePrice, ...rest } = validatedData as any

    // Filtrer les champs autorisés selon les règles de synchronisation
    let globalFields = rest
    if (establishmentId) {
      globalFields = await getGlobalProductFields(tenantId, establishmentId, rest)
    }

    // Si le tenant a un groupe avec syncPriceTtc = false, empêcher la mise à jour globale sans établissement
    if (!establishmentId && price !== undefined) {
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

    // Mettre à jour le prix local si un établissement est ciblé
    if (establishmentId) {
      const priceOverride = price !== undefined && price !== null ? String(price) : null
      const purchasePriceOverride = purchasePrice !== undefined && purchasePrice !== null ? String(purchasePrice) : null

      const updateResult = await db
        .update(productEstablishments)
        .set({
          priceOverride,
          purchasePriceOverride,
          isAvailable: true,
        })
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
          priceOverride,
          purchasePriceOverride,
          isAvailable: true,
          notes: null,
        })
      }
    } else {
      // Pas d'établissement: mise à jour du prix global
      await db
        .update(products)
        .set({
          price: price !== undefined ? String(price) : undefined,
          purchasePrice: purchasePrice !== undefined ? String(purchasePrice) : undefined,
        } as any)
        .where(
          and(
            eq(products.id, parseInt(id)),
            eq(products.tenantId, tenantId)
          )
        )
    }

    // Synchroniser les modifications vers les autres établissements du groupe
    if (establishmentId) {
      try {
        await syncProductToGroup(tenantId, parseInt(id), establishmentId)
        console.log(`✅ Produit ${id} synchronisé depuis l'établissement ${establishmentId}`)
      } catch (syncError) {
        console.error('❌ Erreur lors de la synchronisation du produit:', syncError)
        // On ne bloque pas la modification, juste un warning
      }
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
