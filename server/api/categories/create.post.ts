import { db } from '~/server/database/connection'
import { categories } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { createCategorySchema, type CreateCategoryInput } from '~/server/validators/category.schema'
import { validateBody } from '~/server/utils/validation'

/**
 * ==========================================
 * API: Créer une catégorie
 * ==========================================
 *
 * POST /api/categories/create
 *
 * Crée une nouvelle catégorie ou sous-catégorie
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    // Validation avec Zod
    const validatedData = await validateBody<CreateCategoryInput>(event, createCategorySchema)

    const [newCategory] = await db.insert(categories).values({
      tenantId,
      ...(validatedData as any),
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
