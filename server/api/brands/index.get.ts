import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    const allBrands = await db
      .select()
      .from(brands)
      .where(
        and(
          eq(brands.tenantId, tenantId),
          eq(brands.isArchived, false)
        )
      )
      .orderBy(brands.name)

    return allBrands
  }
  catch (error: any) {
    console.error('Erreur lors de la récupération des marques:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des marques',
    })
  }
})
