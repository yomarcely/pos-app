import { db } from '~/server/database/connection'
import { sellers, sellerEstablishments } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createSellerSchema, type CreateSellerInput } from '~/server/validators/seller.schema'

/**
 * ==========================================
 * API: Créer un vendeur
 * ==========================================
 *
 * POST /api/sellers/create
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await validateBody<CreateSellerInput>(event, createSellerSchema)

    const [newSeller] = await db
      .insert(sellers)
      .values({
        tenantId,
        name: body.name.trim(),
        code: body.code?.trim() || null,
        isActive: body.isActive ?? true,
      })
      .returning()

    // Affecter le vendeur aux établissements sélectionnés
    if (body.establishmentIds && body.establishmentIds.length > 0) {
      await db.insert(sellerEstablishments).values(
        body.establishmentIds.map(establishmentId => ({
          tenantId,
          sellerId: newSeller.id,
          establishmentId,
        }))
      )
    }

    console.log(`✅ Vendeur créé: ${newSeller.name} (${body.establishmentIds?.length || 0} établissement(s))`)

    return {
      success: true,
      message: 'Vendeur créé avec succès',
      seller: newSeller,
    }
  } catch (error) {
    console.error('Erreur lors de la création du vendeur:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
