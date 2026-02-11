import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createBrandSchema, type CreateBrandInput } from '~/server/validators/brand.schema'
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    const body = await validateBody<CreateBrandInput>(event, createBrandSchema)

    const [newBrand] = await db
      .insert(brands)
      .values({
        tenantId,
        createdByEstablishmentId: establishmentId,
        name: body.name.trim(),
      })
      .returning()

    logger.info({
      brandId: newBrand.id,
      brandName: newBrand.name,
      establishmentId,
      tenantId
    }, 'Brand created')

    return newBrand
  }
  catch (error) {
    logger.error({ err: error }, 'Failed to create brand')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Erreur lors de la création de la marque',
    })
  }
})
