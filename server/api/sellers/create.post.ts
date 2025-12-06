import { db } from '~/server/database/connection'
import { sellers } from '~/server/database/schema'
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

    console.log(`✅ Vendeur créé: ${newSeller.name}`)

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
