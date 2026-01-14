import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createEstablishmentSchema, type CreateEstablishmentInput } from '~/server/validators/establishment.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Créer un établissement
 * ==========================================
 *
 * POST /api/establishments/create
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await validateBody<CreateEstablishmentInput>(event, createEstablishmentSchema)

    const [newEstablishment] = await db
      .insert(establishments)
      .values({
        tenantId,
        name: body.name.trim(),
        address: body.address?.trim() || null,
        postalCode: body.postalCode?.trim() || null,
        city: body.city?.trim() || null,
        country: body.country || 'France',
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        siret: body.siret?.trim() || null,
        naf: body.naf?.trim() || null,
        tvaNumber: body.tvaNumber?.trim() || null,
        isActive: body.isActive ?? true,
      })
      .returning()

    logger.info({
      establishmentId: newEstablishment.id,
      establishmentName: newEstablishment.name,
      tenantId
    }, 'Establishment created')

    return {
      success: true,
      message: 'Établissement créé avec succès',
      establishment: newEstablishment,
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to create establishment')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
