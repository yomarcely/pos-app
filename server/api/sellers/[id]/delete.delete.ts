import { db } from '~/server/database/connection'
import { sellers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Désactiver un vendeur
 * ==========================================
 *
 * DELETE /api/sellers/:id/delete
 *
 * Note: On désactive le vendeur (isActive = false) au lieu de le supprimer
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de vendeur invalide',
      })
    }

    // Vérifier que le vendeur existe
    const [existing] = await db.select().from(sellers).where(
      and(
        eq(sellers.id, id),
        eq(sellers.tenantId, tenantId),
      )
    ).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Vendeur introuvable',
      })
    }

    // Désactiver le vendeur
    await db
      .update(sellers)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sellers.id, id),
          eq(sellers.tenantId, tenantId),
        )
      )

    console.log(`✅ Vendeur désactivé: ${existing.name}`)

    return {
      success: true,
      message: 'Vendeur désactivé avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la désactivation du vendeur:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
