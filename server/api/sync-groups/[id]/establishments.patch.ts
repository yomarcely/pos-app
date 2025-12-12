import { db } from '~/server/database/connection'
import { syncGroups, syncGroupEstablishments, establishments, productEstablishments, customerEstablishments, productStocks } from '~/server/database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Modifier les établissements d'un groupe
 * ==========================================
 *
 * PATCH /api/sync-groups/:id/establishments
 *
 * Ajoute ou retire des établissements d'un groupe de synchronisation
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = parseInt(getRouterParam(event, 'id') || '0')
    const body = await readBody(event)

    const { establishmentIds } = body

    if (!id || !Array.isArray(establishmentIds)) {
      throw createError({
        statusCode: 400,
        message: 'Paramètres invalides (id, establishmentIds requis)',
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

    // Vérifier que tous les établissements existent et appartiennent au tenant
    if (establishmentIds.length > 0) {
      const validEstablishments = await db
        .select({ id: establishments.id })
        .from(establishments)
        .where(
          and(
            eq(establishments.tenantId, tenantId),
            inArray(establishments.id, establishmentIds)
          )
        )

      if (validEstablishments.length !== establishmentIds.length) {
        throw createError({
          statusCode: 400,
          message: 'Certains établissements sont invalides',
        })
      }
    }

    // Récupérer les établissements actuels du groupe
    const currentEstablishments = await db
      .select({ establishmentId: syncGroupEstablishments.establishmentId })
      .from(syncGroupEstablishments)
      .where(eq(syncGroupEstablishments.syncGroupId, id))

    const currentIds = currentEstablishments.map(e => e.establishmentId)

    // Déterminer les établissements à ajouter et à retirer
    const toAdd = establishmentIds.filter(eid => !currentIds.includes(eid))
    const toRemove = currentIds.filter(eid => !establishmentIds.includes(eid))

    // Ajouter les nouveaux établissements (avec transaction atomique)
    if (toAdd.length > 0) {
      await db.transaction(async (trx) => {
        // Ajouter les établissements au groupe
        await trx.insert(syncGroupEstablishments).values(
          toAdd.map(establishmentId => ({
            syncGroupId: id,
            establishmentId,
            tenantId,
          }))
        )

        // Pour chaque nouvel établissement, copier les stocks et liaisons depuis un établissement source
        // On prend le premier établissement existant comme source
        if (currentIds.length > 0) {
          const sourceEstablishmentId = currentIds[0]!

          for (const targetEstId of toAdd) {
            // Copier les product_establishments
            const sourceProductEstabs = await trx
              .select()
              .from(productEstablishments)
              .where(
                and(
                  eq(productEstablishments.tenantId, tenantId),
                  eq(productEstablishments.establishmentId, sourceEstablishmentId)
                )
              )

            if (sourceProductEstabs.length > 0) {
              await trx.insert(productEstablishments).values(
                sourceProductEstabs.map(pe => ({
                  tenantId,
                  productId: pe.productId,
                  establishmentId: targetEstId,
                  priceOverride: pe.priceOverride,
                  purchasePriceOverride: pe.purchasePriceOverride,
                  nameOverride: pe.nameOverride,
                  descriptionOverride: pe.descriptionOverride,
                  barcodeOverride: pe.barcodeOverride,
                  supplierIdOverride: pe.supplierIdOverride,
                  categoryIdOverride: pe.categoryIdOverride,
                  brandIdOverride: pe.brandIdOverride,
                  tvaOverride: pe.tvaOverride,
                  tvaIdOverride: pe.tvaIdOverride,
                  imageOverride: pe.imageOverride,
                  variationGroupIdsOverride: pe.variationGroupIdsOverride,
                  isAvailable: pe.isAvailable,
                  notes: pe.notes,
                }))
              )
            }

            // Copier les product_stocks avec un stock initial à 0
            const sourceProductStocks = await trx
              .select({ productId: productStocks.productId })
              .from(productStocks)
              .where(
                and(
                  eq(productStocks.tenantId, tenantId),
                  eq(productStocks.establishmentId, sourceEstablishmentId)
                )
              )

            if (sourceProductStocks.length > 0) {
              await trx.insert(productStocks).values(
                sourceProductStocks.map(ps => ({
                  tenantId,
                  productId: ps.productId,
                  establishmentId: targetEstId,
                  stock: 0, // Stock initial à 0
                  minStock: 5,
                  stockByVariation: null,
                  minStockByVariation: null,
                }))
              )
            }

            // Copier les customer_establishments
            const sourceCustomerEstabs = await trx
              .select()
              .from(customerEstablishments)
              .where(
                and(
                  eq(customerEstablishments.tenantId, tenantId),
                  eq(customerEstablishments.establishmentId, sourceEstablishmentId)
                )
              )

            if (sourceCustomerEstabs.length > 0) {
              await trx.insert(customerEstablishments).values(
                sourceCustomerEstabs.map(ce => ({
                  tenantId,
                  customerId: ce.customerId,
                  establishmentId: targetEstId,
                  firstNameOverride: ce.firstNameOverride,
                  lastNameOverride: ce.lastNameOverride,
                  emailOverride: ce.emailOverride,
                  phoneOverride: ce.phoneOverride,
                  addressOverride: ce.addressOverride,
                  metadataOverride: ce.metadataOverride,
                  gdprConsentOverride: ce.gdprConsentOverride,
                  gdprConsentDateOverride: ce.gdprConsentDateOverride,
                  marketingConsentOverride: ce.marketingConsentOverride,
                  loyaltyProgramOverride: ce.loyaltyProgramOverride,
                  discountOverride: ce.discountOverride,
                  localDiscount: null,
                  localNotes: null,
                  localLoyaltyPoints: 0,
                  firstPurchaseDate: null,
                  lastPurchaseDate: null,
                  totalPurchases: '0',
                  purchaseCount: 0,
                }))
              )
            }
          }
        }
      })
    }

    // Retirer les établissements qui ne sont plus dans le groupe
    if (toRemove.length > 0) {
      await db
        .delete(syncGroupEstablishments)
        .where(
          and(
            eq(syncGroupEstablishments.syncGroupId, id),
            inArray(syncGroupEstablishments.establishmentId, toRemove)
          )
        )

      // NOTE: On ne supprime PAS les product_establishments, customer_establishments et product_stocks
      // L'établissement garde ses données mais n'est plus synchronisé avec le groupe
    }

    // Récupérer les établissements mis à jour
    const updatedEstablishments = await db
      .select({
        id: establishments.id,
        name: establishments.name,
        city: establishments.city,
      })
      .from(syncGroupEstablishments)
      .innerJoin(
        establishments,
        eq(syncGroupEstablishments.establishmentId, establishments.id)
      )
      .where(eq(syncGroupEstablishments.syncGroupId, id))

    return {
      success: true,
      message: `${toAdd.length} établissement(s) ajouté(s), ${toRemove.length} retiré(s)`,
      establishments: updatedEstablishments,
      added: toAdd,
      removed: toRemove,
    }
  } catch (error) {
    console.error('Erreur lors de la modification des établissements:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
