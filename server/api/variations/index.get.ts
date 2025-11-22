import { db } from '~/server/database/connection'
import { variationGroups, variations } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Récupérer tous les groupes de variations avec leurs variations
 * ==========================================
 *
 * GET /api/variations
 *
 * Retourne la liste de tous les groupes de variations non archivés avec leurs variations
 */

interface Variation {
  id: number
  name: string
  sortOrder: number
}

interface VariationGroup {
  id: number
  name: string
  variations: Variation[]
}

export default defineEventHandler(async () => {
  try {
    // Récupérer tous les groupes non archivés
    const groups = await db
      .select()
      .from(variationGroups)
      .where(eq(variationGroups.isArchived, false))

    // Récupérer toutes les variations non archivées
    const allVariations = await db
      .select()
      .from(variations)
      .where(eq(variations.isArchived, false))

    // Construire la structure avec les variations groupées
    const result: VariationGroup[] = groups.map(group => ({
      id: group.id,
      name: group.name,
      variations: allVariations
        .filter(v => v.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(v => ({
          id: v.id,
          name: v.name,
          sortOrder: v.sortOrder,
        })),
    }))

    return {
      success: true,
      groups: result,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des variations:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
