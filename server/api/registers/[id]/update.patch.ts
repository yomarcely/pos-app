import { db } from '~/server/database/connection'
import { registers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { updateRegisterSchema, type UpdateRegisterInput } from '~/server/validators/register.schema'
import { logger } from '~/server/utils/logger'
import { logEntityUpdate } from '~/server/utils/audit'

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
    assertRole(event, 'manager')
    const id = Number(event.context.params?.id)
    const body = await validateBody<UpdateRegisterInput>(event, updateRegisterSchema)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de caisse invalide',
      })
    }

    interface RegisterUpdateData {
      updatedAt: Date
      establishmentId?: number
      name?: string
      isActive?: boolean
    }

    const updateData: RegisterUpdateData = {
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

    logger.info(`Caisse mise à jour: ${updated.name}`)

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityUpdate({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'register',
      entityId: id,
      changes: {
        name: updated.name,
        establishmentId: updated.establishmentId,
        isActive: updated.isActive,
      },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Caisse mise à jour avec succès',
      register: updated,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour de la caisse')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
