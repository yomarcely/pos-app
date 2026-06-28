import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { updateEstablishmentSchema, type UpdateEstablishmentInput } from '~/server/validators/establishment.schema'
import { logger } from '~/server/utils/logger'
import { logEntityUpdate } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Mettre à jour un établissement
 * ==========================================
 *
 * PATCH /api/establishments/:id/update
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const id = Number(event.context.params?.id)
    const body = await validateBody<UpdateEstablishmentInput>(event, updateEstablishmentSchema)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID d\'établissement invalide',
      })
    }

    interface EstablishmentUpdateData {
      updatedAt: Date
      name?: string
      address?: string | null
      postalCode?: string | null
      city?: string | null
      country?: string | null
      phone?: string | null
      email?: string | null
      siret?: string | null
      naf?: string | null
      tvaNumber?: string | null
      isActive?: boolean
      sharePendingSales?: boolean
    }

    const updateData: EstablishmentUpdateData = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.address !== undefined) updateData.address = body.address?.trim() || null
    if (body.postalCode !== undefined) updateData.postalCode = body.postalCode?.trim() || null
    if (body.city !== undefined) updateData.city = body.city?.trim() || null
    if (body.country !== undefined) updateData.country = body.country?.trim() || null
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null
    if (body.email !== undefined) updateData.email = body.email?.trim() || null
    if (body.siret !== undefined) updateData.siret = body.siret?.trim() || null
    if (body.naf !== undefined) updateData.naf = body.naf?.trim() || null
    if (body.tvaNumber !== undefined) updateData.tvaNumber = body.tvaNumber?.trim() || null
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.sharePendingSales !== undefined) updateData.sharePendingSales = body.sharePendingSales

    // Mettre à jour - SÉCURITÉ: filtre par tenantId ET id
    const [updated] = await db
      .update(establishments)
      .set(updateData)
      .where(
        and(
          eq(establishments.id, id),
          eq(establishments.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Établissement introuvable',
      })
    }

    logger.info(`Établissement mis à jour: ${updated.name}`)

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityUpdate({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'establishment',
      entityId: id,
      changes: {
        name: updated.name,
        address: updated.address,
        city: updated.city,
        siret: updated.siret,
        isActive: updated.isActive,
      },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Établissement mis à jour avec succès',
      establishment: updated,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour de l\'établissement')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
