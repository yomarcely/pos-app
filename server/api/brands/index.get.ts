import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    const allBrands = await db
      .select()
      .from(brands)
      .where(eq(brands.isArchived, false))
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
