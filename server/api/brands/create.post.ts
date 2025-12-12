import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createBrandSchema, type CreateBrandInput } from '~/server/validators/brand.schema'

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

    console.log(`✅ Marque créée: ${newBrand.name} (ID: ${newBrand.id}) par établissement ${establishmentId}`)

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
