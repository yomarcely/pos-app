import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { createBrandSchema, type CreateBrandInput } from '~/server/validators/brand.schema'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
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

    if (!newBrand) {
      throw createError({ statusCode: 500, message: 'Échec de la création de la marque' })
    }

    logger.info({
      brandId: newBrand.id,
      brandName: newBrand.name,
      establishmentId,
      tenantId
    }, 'Brand created')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'brand',
      entityId: newBrand.id,
      snapshot: { name: newBrand.name },
      ipAddress: getRequestIP(event) || null,
    })

    return newBrand
  }
  catch (error) {
    logger.error({ err: error }, 'Failed to create brand')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Une erreur interne s'est produite",
    })
  }
})
