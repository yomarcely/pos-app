import { db } from '~/server/database/connection'
import { categories, products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

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
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de catégorie invalide',
      })
    }

    // Vérifier s'il y a des sous-catégories - SÉCURITÉ: filtre par tenantId
    const subcategories = await db.select().from(categories).where(
      and(
        eq(categories.parentId, id),
        eq(categories.tenantId, tenantId)
      )
    )

    if (subcategories.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'Impossible de supprimer une catégorie contenant des sous-catégories',
      })
    }

    // Vérifier s'il y a des produits dans cette catégorie - SÉCURITÉ: filtre par tenantId
    const productsInCategory = await db.select().from(products).where(
      and(
        eq(products.categoryId, id),
        eq(products.tenantId, tenantId)
      )
    )

    if (productsInCategory.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Impossible de supprimer une catégorie contenant ${productsInCategory.length} produit(s)`,
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

    return {
      success: true,
      message: 'Catégorie supprimée avec succès',
      category: archived,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression de la catégorie')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
