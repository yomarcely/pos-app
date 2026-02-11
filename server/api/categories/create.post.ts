import { db } from '~/server/database/connection'
import { categories } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { createCategorySchema, type CreateCategoryInput } from '~/server/validators/category.schema'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Créer une catégorie
 * ==========================================
 *
 * POST /api/categories/create?establishmentId=123
 *
 * Crée une nouvelle catégorie ou sous-catégorie
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    const validatedData = await validateBody<CreateCategoryInput>(event, createCategorySchema)

    const [newCategory] = await db.insert(categories).values({
      tenantId,
      createdByEstablishmentId: establishmentId,
      ...validatedData,
    }).returning()

    logger.info({
      categoryId: newCategory.id,
      categoryName: newCategory.name,
      establishmentId,
      tenantId
    }, 'Category created')

    return {
      success: true,
      message: 'Catégorie créée avec succès',
      category: newCategory,
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to create category')

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
