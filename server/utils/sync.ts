import { db } from '~/server/database/connection'
import {
  syncGroups,
  syncGroupEstablishments,
  syncRules,
  products,
  customers,
  syncLogs,
  productStocks,
} from '~/server/database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import type { SyncResult } from '~/types/sync'

/**
 * ==========================================
 * UTILITAIRES DE SYNCHRONISATION
 * ==========================================
 *
 * Fonctions pour synchroniser automatiquement les produits et clients
 * entre les établissements d'un même groupe de synchronisation
 */

/**
 * Filtre les champs d'un produit selon les règles de synchronisation
 * Retourne uniquement les champs qui PEUVENT être modifiés globalement
 */
export async function getGlobalProductFields(
  tenantId: string,
  establishmentId: number,
  fields: Record<string, any>
): Promise<Record<string, any>> {
  // Récupérer les règles de synchronisation
  const groups = await getSyncGroupsForEstablishment(tenantId, establishmentId)

  if (groups.length === 0) {
    // Pas de groupe de sync, tous les champs sont globaux
    return fields
  }

  const allowedFields: Record<string, any> = {}
  const blockedFields: string[] = []

  // Prendre les règles du premier groupe (on suppose qu'un établissement n'est que dans un seul groupe)
  const rules = groups[0]?.productRules

  if (!rules) {
    // Pas de règles produit, tous les champs sont globaux
    return fields
  }

  // Filtrer selon les règles
  if (rules.syncName && fields.name !== undefined) {
    allowedFields.name = fields.name
  } else if (fields.name !== undefined) {
    blockedFields.push('name')
  }

  if (rules.syncDescription && fields.description !== undefined) {
    allowedFields.description = fields.description
  } else if (fields.description !== undefined) {
    blockedFields.push('description')
  }

  if (rules.syncBarcode && fields.barcode !== undefined) {
    allowedFields.barcode = fields.barcode
  } else if (fields.barcode !== undefined) {
    blockedFields.push('barcode')
  }

  if (rules.syncBarcode && fields.barcodeByVariation !== undefined) {
    allowedFields.barcodeByVariation = fields.barcodeByVariation
  } else if (fields.barcodeByVariation !== undefined) {
    blockedFields.push('barcodeByVariation')
  }

  if (rules.syncCategory && fields.categoryId !== undefined) {
    allowedFields.categoryId = fields.categoryId
  } else if (fields.categoryId !== undefined) {
    blockedFields.push('categoryId')
  }

  if (rules.syncSupplier && fields.supplierId !== undefined) {
    allowedFields.supplierId = fields.supplierId
  } else if (fields.supplierId !== undefined) {
    blockedFields.push('supplierId')
  }

  if (rules.syncSupplier && fields.supplierCode !== undefined) {
    allowedFields.supplierCode = fields.supplierCode
  } else if (fields.supplierCode !== undefined) {
    blockedFields.push('supplierCode')
  }

  if (rules.syncBrand && fields.brandId !== undefined) {
    allowedFields.brandId = fields.brandId
  } else if (fields.brandId !== undefined) {
    blockedFields.push('brandId')
  }

  if (rules.syncPriceHt && fields.purchasePrice !== undefined) {
    allowedFields.purchasePrice = fields.purchasePrice
  } else if (fields.purchasePrice !== undefined) {
    blockedFields.push('purchasePrice')
  }

  if (rules.syncTva && fields.tvaId !== undefined) {
    allowedFields.tvaId = fields.tvaId
  } else if (fields.tvaId !== undefined) {
    blockedFields.push('tvaId')
  }

  if (rules.syncTva && fields.tva !== undefined) {
    allowedFields.tva = fields.tva
  } else if (fields.tva !== undefined) {
    blockedFields.push('tva')
  }

  if (rules.syncImage && fields.image !== undefined) {
    allowedFields.image = fields.image
  } else if (fields.image !== undefined) {
    blockedFields.push('image')
  }

  if (rules.syncVariations && fields.variationGroupIds !== undefined) {
    allowedFields.variationGroupIds = fields.variationGroupIds
  } else if (fields.variationGroupIds !== undefined) {
    blockedFields.push('variationGroupIds')
  }

  if (rules.syncVariations && fields.hasVariations !== undefined) {
    allowedFields.hasVariations = fields.hasVariations
  } else if (fields.hasVariations !== undefined) {
    blockedFields.push('hasVariations')
  }

  // Les champs qui sont TOUJOURS autorisés (non liés à la sync)
  if (fields.updatedAt !== undefined) allowedFields.updatedAt = fields.updatedAt
  if (fields.minStock !== undefined) allowedFields.minStock = fields.minStock
  if (fields.minStockByVariation !== undefined) allowedFields.minStockByVariation = fields.minStockByVariation

  // Logger les champs bloqués pour debug
  if (blockedFields.length > 0) {
    console.log(`⚠️  Champs non synchronisés ignorés: ${blockedFields.join(', ')}`)
  }

  return allowedFields
}

/**
 * Récupère les groupes de synchronisation auxquels appartient un établissement
 */
export async function getSyncGroupsForEstablishment(
  tenantId: string,
  establishmentId: number
): Promise<Array<{
  id: number
  name: string
  productRules: any
  customerRules: any
  targetEstablishments: number[]
}>> {
  // Trouver les groupes de sync de cet établissement
  const groupIds = await db
    .select({ syncGroupId: syncGroupEstablishments.syncGroupId })
    .from(syncGroupEstablishments)
    .where(
      and(
        eq(syncGroupEstablishments.tenantId, tenantId),
        eq(syncGroupEstablishments.establishmentId, establishmentId)
      )
    )

  if (groupIds.length === 0) {
    return []
  }

  // Récupérer les détails de chaque groupe
  const groups = await Promise.all(
    groupIds.map(async ({ syncGroupId }) => {
      const [group] = await db
        .select()
        .from(syncGroups)
        .where(eq(syncGroups.id, syncGroupId))

      // Récupérer les règles
      const rules = await db
        .select()
        .from(syncRules)
        .where(eq(syncRules.syncGroupId, syncGroupId))

      const productRules = rules.find(r => r.entityType === 'product')
      const customerRules = rules.find(r => r.entityType === 'customer')

      // Récupérer les autres établissements du groupe (sauf celui d'origine)
      const targetEstabs = await db
        .select({ establishmentId: syncGroupEstablishments.establishmentId })
        .from(syncGroupEstablishments)
        .where(
          and(
            eq(syncGroupEstablishments.syncGroupId, syncGroupId),
            eq(syncGroupEstablishments.tenantId, tenantId)
          )
        )

      const targetEstablishments = targetEstabs
        .map(e => e.establishmentId)
        .filter(id => id !== establishmentId)

      return {
        id: group.id,
        name: group.name,
        productRules,
        customerRules,
        targetEstablishments,
      }
    })
  )

  return groups
}

/**
 * Synchronise un produit vers tous les établissements d'un groupe
 */
export async function syncProductToGroup(
  tenantId: string,
  productId: number,
  sourceEstablishmentId: number
): Promise<SyncResult[]> {
  const results: SyncResult[] = []

  try {
    // Récupérer le produit source
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))

    if (!product) {
      throw new Error('Produit non trouvé')
    }

    // Récupérer les groupes de sync
    const groups = await getSyncGroupsForEstablishment(tenantId, sourceEstablishmentId)

    for (const group of groups) {
      if (!group.productRules) continue

      const rules = group.productRules
      const syncedFields: string[] = []

      // Construire l'objet des champs à synchroniser
      const fieldsToSync: any = {}

      if (rules.syncName) {
        fieldsToSync.name = product.name
        syncedFields.push('name')
      }
      if (rules.syncDescription) {
        fieldsToSync.description = product.description
        syncedFields.push('description')
      }
      if (rules.syncBarcode) {
        fieldsToSync.barcode = product.barcode
        fieldsToSync.barcodeByVariation = product.barcodeByVariation
        syncedFields.push('barcode')
      }
      if (rules.syncCategory) {
        fieldsToSync.categoryId = product.categoryId
        syncedFields.push('categoryId')
      }
      if (rules.syncSupplier) {
        fieldsToSync.supplierId = product.supplierId
        fieldsToSync.supplierCode = product.supplierCode
        syncedFields.push('supplierId')
      }
      if (rules.syncBrand) {
        fieldsToSync.brandId = product.brandId
        syncedFields.push('brandId')
      }
      if (rules.syncPriceTtc) {
        fieldsToSync.price = product.price
        syncedFields.push('price')
      }
      if (rules.syncPriceHt) {
        fieldsToSync.purchasePrice = product.purchasePrice
        syncedFields.push('purchasePrice')
      }
      if (rules.syncTva) {
        fieldsToSync.tvaId = product.tvaId
        fieldsToSync.tva = product.tva
        syncedFields.push('tvaId')
      }
      if (rules.syncImage) {
        fieldsToSync.image = product.image
        syncedFields.push('image')
      }
      if (rules.syncVariations) {
        fieldsToSync.variationGroupIds = product.variationGroupIds
        syncedFields.push('variationGroupIds')
      }

      fieldsToSync.updatedAt = new Date()

      const errors: Array<{ establishmentId: number; error: string }> = []

      // Mettre à jour le produit (les champs synchronisés sont globaux, pas par établissement)
      // La synchronisation met à jour le produit lui-même car il est partagé
      try {
        await db
          .update(products)
          .set(fieldsToSync)
          .where(eq(products.id, productId))

        // Pour chaque établissement cible, s'assurer qu'il a un stock initialisé
        for (const targetEstabId of group.targetEstablishments) {
          try {
            // Vérifier si le stock existe déjà
            const [existingStock] = await db
              .select()
              .from(productStocks)
              .where(
                and(
                  eq(productStocks.productId, productId),
                  eq(productStocks.establishmentId, targetEstabId)
                )
              )

            // Si le stock n'existe pas, le créer avec un stock à 0
            if (!existingStock) {
              await db.insert(productStocks).values({
                tenantId,
                productId,
                establishmentId: targetEstabId,
                stock: 0,
                stockByVariation: [],
                minStock: 5,
              })
            }
          } catch (error) {
            console.error(`Erreur lors de l'initialisation du stock pour l'établissement ${targetEstabId}:`, error)
            errors.push({
              establishmentId: targetEstabId,
              error: error instanceof Error ? error.message : 'Erreur inconnue',
            })
          }
        }
      } catch (error) {
        console.error('Erreur lors de la synchronisation du produit:', error)
        errors.push({
          establishmentId: -1,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        })
      }

      // Logger la synchronisation
      await db.insert(syncLogs).values({
        tenantId,
        syncGroupId: group.id,
        entityType: 'product',
        entityId: productId,
        sourceEstablishmentId,
        action: 'update',
        syncedFields: { fields: syncedFields },
      })

      results.push({
        success: errors.length === 0,
        syncGroupId: group.id,
        entityType: 'product',
        entityId: productId,
        sourceEstablishmentId,
        targetEstablishments: group.targetEstablishments,
        syncedFields,
        errors,
        timestamp: new Date(),
      })
    }

    return results
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error)
    throw error
  }
}

/**
 * Synchronise un client vers tous les établissements d'un groupe
 */
export async function syncCustomerToGroup(
  tenantId: string,
  customerId: number,
  sourceEstablishmentId: number
): Promise<SyncResult[]> {
  const results: SyncResult[] = []

  try {
    // Récupérer le client source
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))

    if (!customer) {
      throw new Error('Client non trouvé')
    }

    // Récupérer les groupes de sync
    const groups = await getSyncGroupsForEstablishment(tenantId, sourceEstablishmentId)

    for (const group of groups) {
      if (!group.customerRules) continue

      const rules = group.customerRules
      const syncedFields: string[] = []

      // Construire l'objet des champs à synchroniser
      const fieldsToSync: any = {}

      if (rules.syncCustomerInfo) {
        fieldsToSync.firstName = customer.firstName
        fieldsToSync.lastName = customer.lastName
        syncedFields.push('firstName', 'lastName')
      }
      if (rules.syncCustomerContact) {
        fieldsToSync.email = customer.email
        fieldsToSync.phone = customer.phone
        syncedFields.push('email', 'phone')
      }
      if (rules.syncCustomerAddress) {
        fieldsToSync.address = customer.address
        fieldsToSync.metadata = customer.metadata
        syncedFields.push('address', 'metadata')
      }
      if (rules.syncCustomerGdpr) {
        fieldsToSync.gdprConsent = customer.gdprConsent
        fieldsToSync.gdprConsentDate = customer.gdprConsentDate
        fieldsToSync.marketingConsent = customer.marketingConsent
        syncedFields.push('gdprConsent')
      }
      if (rules.syncLoyaltyProgram) {
        fieldsToSync.loyaltyProgram = customer.loyaltyProgram
        syncedFields.push('loyaltyProgram')
      }
      if (rules.syncDiscount) {
        fieldsToSync.discount = customer.discount
        syncedFields.push('discount')
      }

      fieldsToSync.updatedAt = new Date()

      const errors: Array<{ establishmentId: number; error: string }> = []

      // Mettre à jour le client (champs synchronisés globaux)
      try {
        await db
          .update(customers)
          .set(fieldsToSync)
          .where(eq(customers.id, customerId))
      } catch (error) {
        console.error('Erreur lors de la synchronisation du client:', error)
        errors.push({
          establishmentId: -1,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        })
      }

      // Logger la synchronisation
      await db.insert(syncLogs).values({
        tenantId,
        syncGroupId: group.id,
        entityType: 'customer',
        entityId: customerId,
        sourceEstablishmentId,
        action: 'update',
        syncedFields: { fields: syncedFields },
      })

      results.push({
        success: errors.length === 0,
        syncGroupId: group.id,
        entityType: 'customer',
        entityId: customerId,
        sourceEstablishmentId,
        targetEstablishments: group.targetEstablishments,
        syncedFields,
        errors,
        timestamp: new Date(),
      })
    }

    return results
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error)
    throw error
  }
}
