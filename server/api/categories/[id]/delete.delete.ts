import { db } from '~/server/database/connection'
import { categories, products } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

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
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de catégorie invalide',
      })
    }

    // Vérifier que la catégorie existe
    const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Catégorie introuvable',
      })
    }

    // Vérifier s'il y a des sous-catégories
    const subcategories = await db.select().from(categories).where(eq(categories.parentId, id))

    if (subcategories.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'Impossible de supprimer une catégorie contenant des sous-catégories',
      })
    }

    // Vérifier s'il y a des produits dans cette catégorie
    const productsInCategory = await db.select().from(products).where(eq(products.categoryId, id))

    if (productsInCategory.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Impossible de supprimer une catégorie contenant ${productsInCategory.length} produit(s)`,
      })
    }

    // Archiver la catégorie (soft delete)
    const [archived] = await db
      .update(categories)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning()

    console.log(`🗑️ Catégorie archivée: ${archived.name}`)

    return {
      success: true,
      message: 'Catégorie supprimée avec succès',
      category: archived,
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
