import { db } from '~/server/database/connection'
import { variations, variationGroups } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Créer une variation
 * ==========================================
 *
 * POST /api/variations/create
 *
 * Crée une nouvelle variation dans un groupe (ex: "Rouge", "Bleu", "S", "M", "L")
 */

interface CreateVariationRequest {
  groupId: number
  name: string
  sortOrder?: number
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateVariationRequest>(event)

    if (!body.name || body.name.trim() === '') {
      throw createError({
        statusCode: 400,
        message: 'Le nom de la variation est obligatoire',
      })
    }

    if (!body.groupId) {
      throw createError({
        statusCode: 400,
        message: 'L\'ID du groupe de variation est obligatoire',
      })
    }

    // Vérifier que le groupe existe
    const [group] = await db.select().from(variationGroups).where(eq(variationGroups.id, body.groupId)).limit(1)

    if (!group) {
      throw createError({
        statusCode: 404,
        message: 'Groupe de variation introuvable',
      })
    }

    const [newVariation] = await db.insert(variations).values({
      groupId: body.groupId,
      name: body.name.trim(),
      sortOrder: body.sortOrder || 0,
    }).returning()

    console.log(`✅ Variation créée: ${newVariation.name} dans le groupe ${group.name} (ID: ${newVariation.id})`)

    return {
      success: true,
      message: 'Variation créée avec succès',
      variation: newVariation,
    }
  } catch (error) {
    console.error('Erreur lors de la création de la variation:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
