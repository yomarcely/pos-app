import { db } from '~/server/database/connection'
import { establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

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

    return {
      success: true,
      message: 'Établissement désactivé avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la désactivation de l\'établissement')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
