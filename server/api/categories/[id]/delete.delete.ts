import { db } from '~/server/database/connection'
import { categories, products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logEntityDeactivation } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Supprimer une catégorie
 * ==========================================
 *
 * DELETE /api/categories/:id/delete
 *
 * Archive la catégorie au lieu de la supprimer (soft delete)
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de catégorie invalide',
      })
    }

    // Vérifier s'il y a des sous-catégories - SÉCURITÉ: filtre par tenantId
    const subcategories = await db.select({ id: categories.id }).from(categories).where(
      and(
        eq(categories.parentId, id),
        eq(categories.tenantId, tenantId)
      )
    ).limit(1)

    if (subcategories.length > 0) {
      throw createError({
        statusCode: 409,
        message: 'Cette catégorie contient des sous-catégories. Supprimez-les d\'abord.',
      })
    }

    // Vérifier s'il y a des produits dans cette catégorie - SÉCURITÉ: filtre par tenantId
    const productsInCategory = await db.select({ id: products.id }).from(products).where(
      and(
        eq(products.categoryId, id),
        eq(products.tenantId, tenantId)
      )
    ).limit(1)

    if (productsInCategory.length > 0) {
      throw createError({
        statusCode: 409,
        message: 'Cette catégorie est utilisée par des produits et ne peut pas être supprimée',
      })
    }

    // Archiver la catégorie (soft delete) - SÉCURITÉ: filtre par tenantId ET id
    const [archived] = await db
      .update(categories)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(categories.id, id),
          eq(categories.tenantId, tenantId)
        )
      )
      .returning()

    if (!archived) {
      throw createError({
        statusCode: 404,
        message: 'Catégorie introuvable',
      })
    }

    logger.info(`Catégorie archivée: ${archived.name}`)

    // Q12 — Audit log (soft delete)
    const auth = event.context.auth
    await logEntityDeactivation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'category',
      entityId: id,
      snapshot: { name: archived.name },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Catégorie supprimée avec succès',
      category: archived,
    }
  } catch (error) {
    // Re-throw H3 errors (409, 400, 404) as-is
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    logger.error({ err: error }, 'Erreur lors de la suppression de la catégorie')

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
