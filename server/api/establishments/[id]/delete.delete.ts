import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logEntityDeactivation } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Désactiver un établissement
 * ==========================================
 *
 * DELETE /api/establishments/:id/delete
 *
 * Note: On désactive l'établissement (isActive = false) au lieu de le supprimer
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'admin')
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID d\'établissement invalide',
      })
    }

    // Vérifier que l'établissement existe
    const [existing] = await db.select().from(establishments).where(
      and(
        eq(establishments.id, id),
        eq(establishments.tenantId, tenantId),
      )
    ).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Établissement introuvable',
      })
    }

    // Désactiver l'établissement
    await db
      .update(establishments)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(establishments.id, id),
          eq(establishments.tenantId, tenantId),
        )
      )

    logger.info(`Établissement désactivé: ${existing.name}`)

    // Q6 — Audit log de la désactivation (impact NF525 — numérotation peut décaler)
    const auth = event.context.auth
    await logEntityDeactivation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'establishment',
      entityId: id,
      snapshot: { name: existing.name },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Établissement désactivé avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la désactivation de l\'établissement')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
