import { db } from '~/server/database/connection'
import { syncGroups, syncGroupEstablishments, products, productEstablishments, customers, customerEstablishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

// Types pour les valeurs de resync produits
interface ProductSourceValues {
  price: string | null
  purchasePrice: string | null
  name: string | null
  description: string | null
  barcode: string | null
  supplierId: number | null
  categoryId: number | null
  brandId: number | null
  tva: number | null
  tvaId: number | null
  image: string | null
  variationGroupIds: number[] | null
}

interface ProductGlobalUpdate {
  price?: string | null
  purchasePrice?: string | null
  name?: string | null
  description?: string | null
  barcode?: string | null
  supplierId?: number | null
  categoryId?: number | null
  brandId?: number | null
  tva?: number | null
  tvaId?: number | null
  image?: string | null
  variationGroupIds?: number[] | null
}

interface ProductOverrideReset {
  priceOverride?: null
  purchasePriceOverride?: null
  nameOverride?: null
  descriptionOverride?: null
  barcodeOverride?: null
  supplierIdOverride?: null
  categoryIdOverride?: null
  brandIdOverride?: null
  tvaOverride?: null
  tvaIdOverride?: null
  imageOverride?: null
  variationGroupIdsOverride?: null
}

// Types pour les valeurs de resync clients
interface CustomerSourceValues {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  address: string | null
  metadata: Record<string, unknown> | null
  gdprConsent: boolean | null
  gdprConsentDate: Date | null
  marketingConsent: boolean | null
  loyaltyProgram: string | null
  discount: string | null
}

interface CustomerGlobalUpdate {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  metadata?: Record<string, unknown> | null
  gdprConsent?: boolean | null
  gdprConsentDate?: Date | null
  marketingConsent?: boolean | null
  loyaltyProgram?: string | null
  discount?: string | null
}

interface CustomerOverrideReset {
  firstNameOverride?: null
  lastNameOverride?: null
  emailOverride?: null
  phoneOverride?: null
  addressOverride?: null
  metadataOverride?: null
  gdprConsentOverride?: null
  gdprConsentDateOverride?: null
  marketingConsentOverride?: null
  loyaltyProgramOverride?: null
  discountOverride?: null
}

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
    logger.error({ err: error }, 'Erreur lors de la resynchronisation')

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
 * Resynchronise les produits depuis un établissement source (avec pagination et transaction)
 */
async function resyncProducts(
  tenantId: string,
  sourceEstablishmentId: number,
  targetEstablishmentIds: number[],
  fields: string[]
): Promise<number> {
  let syncedCount = 0
  const pageSize = 100 // Traiter par batches de 100 produits
  let offset = 0

  // On traite les overrides pour toutes les entités du groupe (source + cibles)
  const establishmentIdsForOverrides = [sourceEstablishmentId, ...targetEstablishmentIds]

  // Récupérer les overrides de l'établissement source une seule fois
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

  // Créer une map des overrides par productId
  const overrideMap = new Map(
    sourceOverrides.map(o => [o.productId, o])
  )

  // Traiter les produits par batches
  while (true) {
    // Récupérer un batch de produits
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
      .limit(pageSize)
      .offset(offset)

    if (globalProducts.length === 0) break

    // Traiter ce batch dans une transaction
    await db.transaction(async (trx) => {
      for (const product of globalProducts) {
        const sourceOverride = overrideMap.get(product.id)

        // Déterminer la valeur source (override s'il existe, sinon globale)
        const sourceValues: ProductSourceValues = {
          price: sourceOverride?.priceOverride ?? product.price,
          purchasePrice: sourceOverride?.purchasePriceOverride ?? product.purchasePrice,
          name: sourceOverride?.nameOverride ?? product.name,
          description: sourceOverride?.descriptionOverride ?? product.description,
          barcode: sourceOverride?.barcodeOverride ?? product.barcode,
          supplierId: sourceOverride?.supplierIdOverride ?? product.supplierId,
          categoryId: sourceOverride?.categoryIdOverride ?? product.categoryId,
          brandId: sourceOverride?.brandIdOverride ?? product.brandId,
          tva: sourceOverride?.tvaOverride ?? product.tva,
          tvaId: sourceOverride?.tvaIdOverride ?? product.tvaId,
          image: sourceOverride?.imageOverride ?? product.image,
          variationGroupIds: sourceOverride?.variationGroupIdsOverride ?? product.variationGroupIds,
        }

        // Mettre à jour le produit global si nécessaire
        const globalUpdate: ProductGlobalUpdate = {}
        if (fields.includes('price')) globalUpdate.price = sourceValues.price
        if (fields.includes('purchasePrice')) globalUpdate.purchasePrice = sourceValues.purchasePrice
        if (fields.includes('name')) globalUpdate.name = sourceValues.name
        if (fields.includes('description')) globalUpdate.description = sourceValues.description
        if (fields.includes('barcode')) globalUpdate.barcode = sourceValues.barcode
        if (fields.includes('supplierId')) globalUpdate.supplierId = sourceValues.supplierId
        if (fields.includes('categoryId')) globalUpdate.categoryId = sourceValues.categoryId
        if (fields.includes('brandId')) globalUpdate.brandId = sourceValues.brandId
        if (fields.includes('tva')) globalUpdate.tva = sourceValues.tva
        if (fields.includes('tvaId')) globalUpdate.tvaId = sourceValues.tvaId
        if (fields.includes('image')) globalUpdate.image = sourceValues.image
        if (fields.includes('variationGroupIds')) globalUpdate.variationGroupIds = sourceValues.variationGroupIds

        if (Object.keys(globalUpdate).length > 0) {
          await trx
            .update(products)
            .set(globalUpdate)
            .where(and(eq(products.tenantId, tenantId), eq(products.id, product.id)))
        }

        // Supprimer les overrides pour les champs resynchronisés
        const overrideReset: ProductOverrideReset = {}
        if (fields.includes('price')) overrideReset.priceOverride = null
        if (fields.includes('purchasePrice')) overrideReset.purchasePriceOverride = null
        if (fields.includes('name')) overrideReset.nameOverride = null
        if (fields.includes('description')) overrideReset.descriptionOverride = null
        if (fields.includes('barcode')) overrideReset.barcodeOverride = null
        if (fields.includes('supplierId')) overrideReset.supplierIdOverride = null
        if (fields.includes('categoryId')) overrideReset.categoryIdOverride = null
        if (fields.includes('brandId')) overrideReset.brandIdOverride = null
        if (fields.includes('tva')) overrideReset.tvaOverride = null
        if (fields.includes('tvaId')) overrideReset.tvaIdOverride = null
        if (fields.includes('image')) overrideReset.imageOverride = null
        if (fields.includes('variationGroupIds')) overrideReset.variationGroupIdsOverride = null

        if (Object.keys(overrideReset).length > 0) {
          for (const estId of establishmentIdsForOverrides) {
            const result = await trx
              .update(productEstablishments)
              .set(overrideReset)
              .where(
                and(
                  eq(productEstablishments.tenantId, tenantId),
                  eq(productEstablishments.productId, product.id),
                  eq(productEstablishments.establishmentId, estId)
                )
              )
              .returning({ id: productEstablishments.id })

            if (result.length === 0) {
              await trx.insert(productEstablishments).values({
                tenantId,
                productId: product.id,
                establishmentId: estId,
                ...overrideReset,
                isAvailable: true,
                notes: null,
              })
            }
          }
        }

        syncedCount++
      }
    })

    offset += pageSize
    logger.info({ syncedCount, pageSize }, 'Resync batch de produits traités')
  }

  logger.info({ syncedCount, sourceEstablishmentId }, 'Produits resynchronisés depuis établissement')
  return syncedCount
}

/**
 * Resynchronise les clients depuis un établissement source (avec pagination et transaction)
 */
async function resyncCustomers(
  tenantId: string,
  sourceEstablishmentId: number,
  targetEstablishmentIds: number[],
  fields: string[]
): Promise<number> {
  let syncedCount = 0
  const pageSize = 100 // Traiter par batches de 100 clients
  let offset = 0

  const establishmentIdsForOverrides = [sourceEstablishmentId, ...targetEstablishmentIds]

  // Récupérer les overrides de l'établissement source une seule fois
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

  // Créer une map des overrides par customerId
  const overrideMap = new Map(
    sourceOverrides.map(o => [o.customerId, o])
  )

  // Traiter les clients par batches
  while (true) {
    // Récupérer un batch de clients
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
      .limit(pageSize)
      .offset(offset)

    if (globalCustomers.length === 0) break

    // Traiter ce batch dans une transaction
    await db.transaction(async (trx) => {
      for (const customer of globalCustomers) {
        const sourceOverride = overrideMap.get(customer.id)

        const sourceValues: CustomerSourceValues = {
          firstName: sourceOverride?.firstNameOverride ?? customer.firstName,
          lastName: sourceOverride?.lastNameOverride ?? customer.lastName,
          email: sourceOverride?.emailOverride ?? customer.email,
          phone: sourceOverride?.phoneOverride ?? customer.phone,
          address: sourceOverride?.addressOverride ?? customer.address,
          metadata: (sourceOverride?.metadataOverride ?? customer.metadata) as Record<string, unknown> | null,
          gdprConsent: sourceOverride?.gdprConsentOverride ?? customer.gdprConsent,
          gdprConsentDate: sourceOverride?.gdprConsentDateOverride ?? customer.gdprConsentDate,
          marketingConsent: sourceOverride?.marketingConsentOverride ?? customer.marketingConsent,
          loyaltyProgram: sourceOverride?.loyaltyProgramOverride ?? customer.loyaltyProgram,
          discount: sourceOverride?.discountOverride ?? customer.discount,
        }

        // Mettre à jour le client global
        const globalUpdate: CustomerGlobalUpdate = {}
        if (fields.includes('firstName')) globalUpdate.firstName = sourceValues.firstName
        if (fields.includes('lastName')) globalUpdate.lastName = sourceValues.lastName
        if (fields.includes('email')) globalUpdate.email = sourceValues.email
        if (fields.includes('phone')) globalUpdate.phone = sourceValues.phone
        if (fields.includes('address')) globalUpdate.address = sourceValues.address
        if (fields.includes('metadata')) globalUpdate.metadata = sourceValues.metadata
        if (fields.includes('gdprConsent')) globalUpdate.gdprConsent = sourceValues.gdprConsent
        if (fields.includes('gdprConsentDate')) globalUpdate.gdprConsentDate = sourceValues.gdprConsentDate
        if (fields.includes('marketingConsent')) globalUpdate.marketingConsent = sourceValues.marketingConsent
        if (fields.includes('loyaltyProgram')) globalUpdate.loyaltyProgram = sourceValues.loyaltyProgram
        if (fields.includes('discount')) globalUpdate.discount = sourceValues.discount

        if (Object.keys(globalUpdate).length > 0) {
          await trx
            .update(customers)
            .set(globalUpdate)
            .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customer.id)))
        }

        // Remettre les overrides à null pour les champs resynchronisés
        const overrideReset: CustomerOverrideReset = {}
        if (fields.includes('firstName')) overrideReset.firstNameOverride = null
        if (fields.includes('lastName')) overrideReset.lastNameOverride = null
        if (fields.includes('email')) overrideReset.emailOverride = null
        if (fields.includes('phone')) overrideReset.phoneOverride = null
        if (fields.includes('address')) overrideReset.addressOverride = null
        if (fields.includes('metadata')) overrideReset.metadataOverride = null
        if (fields.includes('gdprConsent')) overrideReset.gdprConsentOverride = null
        if (fields.includes('gdprConsentDate')) overrideReset.gdprConsentDateOverride = null
        if (fields.includes('marketingConsent')) overrideReset.marketingConsentOverride = null
        if (fields.includes('loyaltyProgram')) overrideReset.loyaltyProgramOverride = null
        if (fields.includes('discount')) overrideReset.discountOverride = null

        if (Object.keys(overrideReset).length > 0) {
          for (const estId of establishmentIdsForOverrides) {
            const result = await trx
              .update(customerEstablishments)
              .set(overrideReset)
              .where(
                and(
                  eq(customerEstablishments.tenantId, tenantId),
                  eq(customerEstablishments.customerId, customer.id),
                  eq(customerEstablishments.establishmentId, estId)
                )
              )
              .returning({ id: customerEstablishments.id })

            if (result.length === 0) {
              await trx.insert(customerEstablishments).values({
                tenantId,
                customerId: customer.id,
                establishmentId: estId,
                ...overrideReset,
                localDiscount: null,
                localNotes: null,
                localLoyaltyPoints: 0,
                firstPurchaseDate: null,
                lastPurchaseDate: null,
                totalPurchases: '0',
                purchaseCount: 0,
              })
            }
          }
        }

        syncedCount++
      }
    })

    offset += pageSize
    logger.info({ syncedCount, pageSize }, 'Resync batch de clients traités')
  }

  logger.info({ syncedCount, sourceEstablishmentId }, 'Clients resynchronisés depuis établissement')
  return syncedCount
}
