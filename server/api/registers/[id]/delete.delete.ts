import { db } from '~/server/database/connection'
import { registers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { logEntityDeactivation } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Désactiver une caisse
 * ==========================================
 *
 * DELETE /api/registers/:id/delete
 *
 * Note: On désactive la caisse (isActive = false) au lieu de la supprimer
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de caisse invalide',
      })
    }

    // Vérifier que la caisse existe
    const [existing] = await db.select().from(registers).where(
      and(
        eq(registers.id, id),
        eq(registers.tenantId, tenantId),
      )
    ).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Caisse introuvable',
      })
    }

    // Désactiver la caisse
    await db
      .update(registers)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(registers.id, id),
          eq(registers.tenantId, tenantId),
        )
      )

    logger.info(`Caisse désactivée: ${existing.name}`)

    // Q6 — Audit log de la désactivation
    const auth = event.context.auth
    await logEntityDeactivation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'register',
      entityId: id,
      snapshot: { name: existing.name },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Caisse désactivée avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la désactivation de la caisse')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
