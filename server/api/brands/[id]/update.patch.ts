import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { updateBrandSchema } from '~/server/validators/brand.schema'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de marque invalide',
      })
    }

    const validatedData = await validateBody(event, updateBrandSchema)

    const [updated] = await db
      .update(brands)
      .set({
        ...validatedData,
        name: validatedData.name?.trim(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(brands.id, id),
          eq(brands.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Marque introuvable',
      })
    }

    logger.info({ brandId: updated.id, brandName: updated.name, tenantId }, 'Brand updated')

    return updated
  } catch (error) {
    logger.error({ err: error }, 'Failed to update brand')

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
