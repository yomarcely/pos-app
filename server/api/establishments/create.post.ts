import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createEstablishmentSchema, type CreateEstablishmentInput } from '~/server/validators/establishment.schema'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'

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
        sharePendingSales: body.sharePendingSales ?? false,
      })
      .returning()

    if (!newEstablishment) {
      throw createError({ statusCode: 500, message: 'Échec de la création de l\'établissement' })
    }

    logger.info({
      establishmentId: newEstablishment.id,
      establishmentName: newEstablishment.name,
      tenantId
    }, 'Establishment created')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'establishment',
      entityId: newEstablishment.id,
      snapshot: {
        name: newEstablishment.name,
        city: newEstablishment.city,
        siret: newEstablishment.siret,
        isActive: newEstablishment.isActive,
      },
      ipAddress: getRequestIP(event) || null,
    })

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
