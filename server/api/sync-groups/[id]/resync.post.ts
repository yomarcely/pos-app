import { db } from '~/server/database/connection'
import { syncGroups, syncGroupEstablishments, products, productEstablishments, customers, customerEstablishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Resynchroniser les données d'un groupe
 * ==========================================
 *
 * POST /api/sync-groups/:id/resync
 *
 * Resynchronise les données depuis un établissement source vers les autres
 * Utile quand on réactive une option de synchronisation
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = parseInt(getRouterParam(event, 'id') || '0')
    const body = await readBody(event)

    const {
      sourceEstablishmentId,
      entityType, // 'product' ou 'customer'
      fields, // Array des champs à resynchroniser: ['supplierId', 'categoryId', ...]
    } = body

    if (!id || !sourceEstablishmentId || !entityType || !fields || !Array.isArray(fields)) {
      throw createError({
        statusCode: 400,
        message: 'Paramètres manquants (sourceEstablishmentId, entityType, fields)',
      })
    }

    // Vérifier que le groupe existe
    const [group] = await db
      .select()
      .from(syncGroups)
      .where(and(eq(syncGroups.id, id), eq(syncGroups.tenantId, tenantId)))

    if (!group) {
      throw createError({
        statusCode: 404,
        message: 'Groupe de synchronisation non trouvé',
      })
    }

    // Récupérer tous les établissements du groupe
    const groupEstabs = await db
      .select({ establishmentId: syncGroupEstablishments.establishmentId })
      .from(syncGroupEstablishments)
      .where(
        and(
          eq(syncGroupEstablishments.syncGroupId, id),
          eq(syncGroupEstablishments.tenantId, tenantId)
        )
      )

    const establishmentIds = groupEstabs.map(e => e.establishmentId)
    const targetEstablishmentIds = establishmentIds.filter(eid => eid !== sourceEstablishmentId)

    if (targetEstablishmentIds.length === 0) {
      return {
        success: true,
        message: 'Aucun établissement cible à synchroniser',
        synced: 0,
      }
    }

    let syncedCount = 0

    if (entityType === 'product') {
      // Resynchroniser les produits
      syncedCount = await resyncProducts(
        tenantId,
        sourceEstablishmentId,
        targetEstablishmentIds,
        fields
      )
    } else if (entityType === 'customer') {
      // Resynchroniser les clients
      syncedCount = await resyncCustomers(
        tenantId,
        sourceEstablishmentId,
        targetEstablishmentIds,
        fields
      )
    }

    return {
      success: true,
      message: `${syncedCount} ${entityType === 'product' ? 'produits' : 'clients'} resynchronisés`,
      synced: syncedCount,
      sourceEstablishmentId,
      targetEstablishmentIds,
      fields,
    }
  } catch (error) {
    console.error('Erreur lors de la resynchronisation:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})

/**
 * Resynchronise les produits depuis un établissement source
 */
async function resyncProducts(
  tenantId: string,
  sourceEstablishmentId: number,
  targetEstablishmentIds: number[],
  fields: string[]
): Promise<number> {
  // Récupérer les overrides de l'établissement source
  const sourceOverrides = await db
    .select({
      productId: productEstablishments.productId,
      priceOverride: productEstablishments.priceOverride,
      purchasePriceOverride: productEstablishments.purchasePriceOverride,
      nameOverride: productEstablishments.nameOverride,
      descriptionOverride: productEstablishments.descriptionOverride,
      barcodeOverride: productEstablishments.barcodeOverride,
      supplierIdOverride: productEstablishments.supplierIdOverride,
      categoryIdOverride: productEstablishments.categoryIdOverride,
      brandIdOverride: productEstablishments.brandIdOverride,
      tvaOverride: productEstablishments.tvaOverride,
      tvaIdOverride: productEstablishments.tvaIdOverride,
      imageOverride: productEstablishments.imageOverride,
      variationGroupIdsOverride: productEstablishments.variationGroupIdsOverride,
    })
    .from(productEstablishments)
    .where(
      and(
        eq(productEstablishments.tenantId, tenantId),
        eq(productEstablishments.establishmentId, sourceEstablishmentId)
      )
    )

  // Récupérer les produits globaux
  const globalProducts = await db
    .select({
      id: products.id,
      price: products.price,
      purchasePrice: products.purchasePrice,
      name: products.name,
      description: products.description,
      barcode: products.barcode,
      supplierId: products.supplierId,
      categoryId: products.categoryId,
      brandId: products.brandId,
      tva: products.tva,
      tvaId: products.tvaId,
      image: products.image,
      variationGroupIds: products.variationGroupIds,
    })
    .from(products)
    .where(eq(products.tenantId, tenantId))

  // Créer une map des overrides par productId
  const overrideMap = new Map(
    sourceOverrides.map(o => [o.productId, o])
  )

  let syncedCount = 0

  // Pour chaque établissement cible
  for (const targetEstId of targetEstablishmentIds) {
    // Pour chaque produit
    for (const product of globalProducts) {
      const sourceOverride = overrideMap.get(product.id)
      const updateData: any = {}

      // Construire l'objet de mise à jour selon les champs demandés
      if (fields.includes('price')) {
        updateData.priceOverride = sourceOverride?.priceOverride ?? product.price
      }
      if (fields.includes('purchasePrice')) {
        updateData.purchasePriceOverride = sourceOverride?.purchasePriceOverride ?? product.purchasePrice
      }
      if (fields.includes('name')) {
        updateData.nameOverride = sourceOverride?.nameOverride ?? product.name
      }
      if (fields.includes('description')) {
        updateData.descriptionOverride = sourceOverride?.descriptionOverride ?? product.description
      }
      if (fields.includes('barcode')) {
        updateData.barcodeOverride = sourceOverride?.barcodeOverride ?? product.barcode
      }
      if (fields.includes('supplierId')) {
        updateData.supplierIdOverride = sourceOverride?.supplierIdOverride ?? product.supplierId
      }
      if (fields.includes('categoryId')) {
        updateData.categoryIdOverride = sourceOverride?.categoryIdOverride ?? product.categoryId
      }
      if (fields.includes('brandId')) {
        updateData.brandIdOverride = sourceOverride?.brandIdOverride ?? product.brandId
      }
      if (fields.includes('tva')) {
        updateData.tvaOverride = sourceOverride?.tvaOverride ?? product.tva
      }
      if (fields.includes('tvaId')) {
        updateData.tvaIdOverride = sourceOverride?.tvaIdOverride ?? product.tvaId
      }
      if (fields.includes('image')) {
        updateData.imageOverride = sourceOverride?.imageOverride ?? product.image
      }
      if (fields.includes('variationGroupIds')) {
        updateData.variationGroupIdsOverride = sourceOverride?.variationGroupIdsOverride ?? product.variationGroupIds
      }

      if (Object.keys(updateData).length === 0) continue

      // Mettre à jour l'override pour l'établissement cible
      const result = await db
        .update(productEstablishments)
        .set(updateData)
        .where(
          and(
            eq(productEstablishments.tenantId, tenantId),
            eq(productEstablishments.productId, product.id),
            eq(productEstablishments.establishmentId, targetEstId)
          )
        )
        .returning({ id: productEstablishments.id })

      // Si l'entrée n'existe pas, la créer
      if (result.length === 0) {
        await db.insert(productEstablishments).values({
          tenantId,
          productId: product.id,
          establishmentId: targetEstId,
          ...updateData,
          isAvailable: true,
          notes: null,
        })
      }

      syncedCount++
    }
  }

  console.log(`✅ ${syncedCount} produits resynchronisés depuis établissement ${sourceEstablishmentId}`)
  return syncedCount
}

/**
 * Resynchronise les clients depuis un établissement source
 */
async function resyncCustomers(
  tenantId: string,
  sourceEstablishmentId: number,
  targetEstablishmentIds: number[],
  fields: string[]
): Promise<number> {
  // Récupérer les overrides de l'établissement source
  const sourceOverrides = await db
    .select({
      customerId: customerEstablishments.customerId,
      firstNameOverride: customerEstablishments.firstNameOverride,
      lastNameOverride: customerEstablishments.lastNameOverride,
      emailOverride: customerEstablishments.emailOverride,
      phoneOverride: customerEstablishments.phoneOverride,
      addressOverride: customerEstablishments.addressOverride,
      metadataOverride: customerEstablishments.metadataOverride,
      gdprConsentOverride: customerEstablishments.gdprConsentOverride,
      gdprConsentDateOverride: customerEstablishments.gdprConsentDateOverride,
      marketingConsentOverride: customerEstablishments.marketingConsentOverride,
      loyaltyProgramOverride: customerEstablishments.loyaltyProgramOverride,
      discountOverride: customerEstablishments.discountOverride,
    })
    .from(customerEstablishments)
    .where(
      and(
        eq(customerEstablishments.tenantId, tenantId),
        eq(customerEstablishments.establishmentId, sourceEstablishmentId)
      )
    )

  // Récupérer les clients globaux
  const globalCustomers = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      address: customers.address,
      metadata: customers.metadata,
      gdprConsent: customers.gdprConsent,
      gdprConsentDate: customers.gdprConsentDate,
      marketingConsent: customers.marketingConsent,
      loyaltyProgram: customers.loyaltyProgram,
      discount: customers.discount,
    })
    .from(customers)
    .where(eq(customers.tenantId, tenantId))

  // Créer une map des overrides par customerId
  const overrideMap = new Map(
    sourceOverrides.map(o => [o.customerId, o])
  )

  let syncedCount = 0

  // Pour chaque établissement cible
  for (const targetEstId of targetEstablishmentIds) {
    // Pour chaque client
    for (const customer of globalCustomers) {
      const sourceOverride = overrideMap.get(customer.id)
      const updateData: any = {}

      // Construire l'objet de mise à jour selon les champs demandés
      if (fields.includes('firstName')) {
        updateData.firstNameOverride = sourceOverride?.firstNameOverride ?? customer.firstName
      }
      if (fields.includes('lastName')) {
        updateData.lastNameOverride = sourceOverride?.lastNameOverride ?? customer.lastName
      }
      if (fields.includes('email')) {
        updateData.emailOverride = sourceOverride?.emailOverride ?? customer.email
      }
      if (fields.includes('phone')) {
        updateData.phoneOverride = sourceOverride?.phoneOverride ?? customer.phone
      }
      if (fields.includes('address')) {
        updateData.addressOverride = sourceOverride?.addressOverride ?? customer.address
      }
      if (fields.includes('metadata')) {
        updateData.metadataOverride = sourceOverride?.metadataOverride ?? customer.metadata
      }
      if (fields.includes('gdprConsent')) {
        updateData.gdprConsentOverride = sourceOverride?.gdprConsentOverride ?? customer.gdprConsent
      }
      if (fields.includes('gdprConsentDate')) {
        updateData.gdprConsentDateOverride = sourceOverride?.gdprConsentDateOverride ?? customer.gdprConsentDate
      }
      if (fields.includes('marketingConsent')) {
        updateData.marketingConsentOverride = sourceOverride?.marketingConsentOverride ?? customer.marketingConsent
      }
      if (fields.includes('loyaltyProgram')) {
        updateData.loyaltyProgramOverride = sourceOverride?.loyaltyProgramOverride ?? customer.loyaltyProgram
      }
      if (fields.includes('discount')) {
        updateData.discountOverride = sourceOverride?.discountOverride ?? customer.discount
      }

      if (Object.keys(updateData).length === 0) continue

      // Mettre à jour l'override pour l'établissement cible
      const result = await db
        .update(customerEstablishments)
        .set(updateData)
        .where(
          and(
            eq(customerEstablishments.tenantId, tenantId),
            eq(customerEstablishments.customerId, customer.id),
            eq(customerEstablishments.establishmentId, targetEstId)
          )
        )
        .returning({ id: customerEstablishments.id })

      // Si l'entrée n'existe pas, la créer
      if (result.length === 0) {
        await db.insert(customerEstablishments).values({
          tenantId,
          customerId: customer.id,
          establishmentId: targetEstId,
          ...updateData,
          localDiscount: null,
          localNotes: null,
          localLoyaltyPoints: 0,
          firstPurchaseDate: null,
          lastPurchaseDate: null,
          totalPurchases: '0',
          purchaseCount: 0,
        })
      }

      syncedCount++
    }
  }

  console.log(`✅ ${syncedCount} clients resynchronisés depuis établissement ${sourceEstablishmentId}`)
  return syncedCount
}
