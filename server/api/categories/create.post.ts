import { db } from '~/server/database/connection'
import { categories } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { createCategorySchema, type CreateCategoryInput } from '~/server/validators/category.schema'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'

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
    assertRole(event, 'manager')
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    const validatedData = await validateBody<CreateCategoryInput>(event, createCategorySchema)

    const [newCategory] = await db.insert(categories).values({
      tenantId,
      createdByEstablishmentId: establishmentId,
      ...validatedData,
    }).returning()

    if (!newCategory) {
      throw createError({ statusCode: 500, message: 'Échec de la création de la catégorie' })
    }

    logger.info({
      categoryId: newCategory.id,
      categoryName: newCategory.name,
      establishmentId,
      tenantId
    }, 'Category created')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'category',
      entityId: newCategory.id,
      snapshot: { name: newCategory.name, parentId: newCategory.parentId },
      ipAddress: getRequestIP(event) || null,
    })

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
      message: "Une erreur interne s'est produite",
    })
  }
})
