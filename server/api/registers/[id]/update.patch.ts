import { db } from '~/server/database/connection'
import { registers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateRegisterSchema, type UpdateRegisterInput } from '~/server/validators/register.schema'

/**
 * ==========================================
 * API: Mettre à jour une caisse
 * ==========================================
 *
 * PATCH /api/registers/:id/update
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)
    const body = await validateBody<UpdateRegisterInput>(event, updateRegisterSchema)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de caisse invalide',
      })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.establishmentId !== undefined) updateData.establishmentId = body.establishmentId
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Mettre à jour - SÉCURITÉ: filtre par tenantId ET id
    const [updated] = await db
      .update(registers)
      .set(updateData)
      .where(
        and(
          eq(registers.id, id),
          eq(registers.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Caisse introuvable',
      })
    }

    console.log(`✅ Caisse mise à jour: ${updated.name}`)

    return {
      success: true,
      message: 'Caisse mise à jour avec succès',
      register: updated,
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la caisse:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
