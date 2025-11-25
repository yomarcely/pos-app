// server/api/database/seed.post.ts
import { seedDatabase } from '~/server/database/seed'

/**
 * ==========================================
 * API: Seed database with mock data
 * ==========================================
 *
 * POST /api/database/seed
 *
 * Peuple la base de données avec les données de vendeurs et produits
 */

export default defineEventHandler(async (event) => {
  try {
    console.log('🌱 Démarrage du seed de la base de données (API)...')
    const result = await seedDatabase({ reset: false })

    console.log('✨ Seed terminé avec succès!')

    return {
      success: true,
      message: 'Base de données seedée avec succès',
      result,
    }
  } catch (error: any) {
    console.error('❌ Erreur lors du seed:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors du seed de la base de données',
      message: error.message,
    })
  }
})
