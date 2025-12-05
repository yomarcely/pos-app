import { db } from '~/server/database/connection'
import { suppliers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    const allSuppliers = await db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          eq(suppliers.isArchived, false)
        )
      )
      .orderBy(suppliers.name)

    return allSuppliers
  }
  catch (error: any) {
    console.error('Erreur lors de la récupération des fournisseurs:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des fournisseurs',
    })
  }
})
