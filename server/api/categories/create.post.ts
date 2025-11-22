import { db } from '~/server/database/connection'
import { categories } from '~/server/database/schema'

/**
 * ==========================================
 * API: Créer une catégorie
 * ==========================================
 *
 * POST /api/categories/create
 *
 * Crée une nouvelle catégorie ou sous-catégorie
 */

interface CreateCategoryRequest {
  name: string
  parentId?: number | null
  sortOrder?: number
  icon?: string
  color?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateCategoryRequest>(event)

    if (!body.name || body.name.trim() === '') {
      throw createError({
        statusCode: 400,
        message: 'Le nom de la catégorie est obligatoire',
      })
    }

    const [newCategory] = await db.insert(categories).values({
      name: body.name.trim(),
      parentId: body.parentId || null,
      sortOrder: body.sortOrder || 0,
      icon: body.icon || null,
      color: body.color || null,
    }).returning()

    console.log(`✅ Catégorie créée: ${newCategory.name} (ID: ${newCategory.id})`)

    return {
      success: true,
      message: 'Catégorie créée avec succès',
      category: newCategory,
    }
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
