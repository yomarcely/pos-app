import { db } from '~/server/database/connection'
import { registers } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createRegisterSchema, type CreateRegisterInput } from '~/server/validators/register.schema'

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

    console.log(`✅ Caisse créée: ${newRegister.name}`)

    return {
      success: true,
      message: 'Caisse créée avec succès',
      register: newRegister,
    }
  } catch (error) {
    console.error('Erreur lors de la création de la caisse:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
