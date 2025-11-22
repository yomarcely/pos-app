import { db } from '~/server/database/connection'
import { variationGroups } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Mettre à jour un groupe de variation
 * ==========================================
 *
 * PATCH /api/variations/groups/:id/update
 */

interface UpdateGroupRequest {
  name?: string
}

export default defineEventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id)
    const body = await readBody<UpdateGroupRequest>(event)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de groupe invalide',
      })
    }

    // Vérifier que le groupe existe
    const [existing] = await db.select().from(variationGroups).where(eq(variationGroups.id, id)).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Groupe de variation introuvable',
      })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()

    const [updated] = await db
      .update(variationGroups)
      .set(updateData)
      .where(eq(variationGroups.id, id))
      .returning()

    console.log(`✅ Groupe de variation mis à jour: ${updated.name}`)

    return {
      success: true,
      message: 'Groupe de variation mis à jour avec succès',
      group: updated,
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du groupe de variation:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
