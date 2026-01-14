import { db } from '~/server/database/connection'
import { registers } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createRegisterSchema, type CreateRegisterInput } from '~/server/validators/register.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Créer une caisse
 * ==========================================
 *
 * POST /api/registers/create
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await validateBody<CreateRegisterInput>(event, createRegisterSchema)

    const [newRegister] = await db
      .insert(registers)
      .values({
        tenantId,
        establishmentId: body.establishmentId,
        name: body.name.trim(),
        isActive: body.isActive ?? true,
      })
      .returning()

    logger.info({
      registerId: newRegister.id,
      registerName: newRegister.name,
      establishmentId: body.establishmentId,
      tenantId
    }, 'Register created')

    return {
      success: true,
      message: 'Caisse créée avec succès',
      register: newRegister,
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to create register')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
