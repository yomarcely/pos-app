import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createBrandSchema, type CreateBrandInput } from '~/server/validators/brand.schema'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    const body = await validateBody<CreateBrandInput>(event, createBrandSchema)

    const [newBrand] = await db
      .insert(brands)
      .values({
        tenantId,
        name: body.name.trim(),
      })
      .returning()

    return newBrand
  }
  catch (error: any) {
    console.error('Erreur lors de la création de la marque:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Erreur lors de la création de la marque',
    })
  }
})
