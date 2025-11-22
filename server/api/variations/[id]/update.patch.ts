import { db } from '~/server/database/connection'
import { variations } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Mettre à jour une variation
 * ==========================================
 *
 * PATCH /api/variations/:id/update
 */

interface UpdateVariationRequest {
  name?: string
  sortOrder?: number
}

export default defineEventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id)
    const body = await readBody<UpdateVariationRequest>(event)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de variation invalide',
      })
    }

    // Vérifier que la variation existe
    const [existing] = await db.select().from(variations).where(eq(variations.id, id)).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Variation introuvable',
      })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder

    const [updated] = await db
      .update(variations)
      .set(updateData)
      .where(eq(variations.id, id))
      .returning()

    console.log(`✅ Variation mise à jour: ${updated.name}`)

    return {
      success: true,
      message: 'Variation mise à jour avec succès',
      variation: updated,
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la variation:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
