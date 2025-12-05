import { db } from '~/server/database/connection'
import { categories } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { updateCategorySchema } from '~/server/validators/category.schema'
import { validateBody } from '~/server/utils/validation'

/**
 * ==========================================
 * API: Mettre à jour une catégorie
 * ==========================================
 *
 * PATCH /api/categories/:id/update
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

    // Validation avec Zod
    const validatedData = await validateBody(event, updateCategorySchema)

    // Vérifier qu'on ne créé pas de boucle (catégorie parent de elle-même)
    if (validatedData.parentId === id) {
      throw createError({
        statusCode: 400,
        message: 'Une catégorie ne peut pas être son propre parent',
      })
    }

    // Mettre à jour - SÉCURITÉ: filtre par tenantId ET id
    const [updated] = await db
      .update(categories)
      .set({ ...validatedData as any, updatedAt: new Date() })
      .where(
        and(
          eq(categories.id, id),
          eq(categories.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Catégorie introuvable',
      })
    }

    console.log(`✅ Catégorie mise à jour: ${updated.name}`)

    return {
      success: true,
      message: 'Catégorie mise à jour avec succès',
      category: updated,
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
