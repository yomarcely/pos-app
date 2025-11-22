import { db } from '~/server/database/connection'
import { variations } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Supprimer une variation
 * ==========================================
 *
 * DELETE /api/variations/:id/delete
 *
 * Suppression soft (archivage)
 */

export default defineEventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id)

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

    // Soft delete
    await db
      .update(variations)
      .set({
        isArchived: true,
        archivedAt: new Date(),
      })
      .where(eq(variations.id, id))

    console.log(`✅ Variation archivée: ${existing.name}`)

    return {
      success: true,
      message: 'Variation supprimée avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de la variation:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
