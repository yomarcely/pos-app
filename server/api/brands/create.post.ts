import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { name } = body

    if (!name || !name.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le nom de la marque est requis',
      })
    }

    const [newBrand] = await db
      .insert(brands)
      .values({
        name: name.trim(),
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
