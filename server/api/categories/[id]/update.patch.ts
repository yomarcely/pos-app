import { db } from '~/server/database/connection'
import { categories } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Mettre à jour une catégorie
 * ==========================================
 *
 * PATCH /api/categories/:id/update
 */

interface UpdateCategoryRequest {
  name?: string
  parentId?: number | null
  sortOrder?: number
  icon?: string | null
  color?: string | null
}

export default defineEventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id)
    const body = await readBody<UpdateCategoryRequest>(event)

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

    // Vérifier qu'on ne créé pas de boucle (catégorie parent de elle-même)
    if (body.parentId === id) {
      throw createError({
        statusCode: 400,
        message: 'Une catégorie ne peut pas être son propre parent',
      })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.parentId !== undefined) updateData.parentId = body.parentId
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.color !== undefined) updateData.color = body.color

    const [updated] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning()

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
