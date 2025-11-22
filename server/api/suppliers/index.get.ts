import { db } from '~/server/database/connection'
import { suppliers } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    const allSuppliers = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.isArchived, false))
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
