import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Récupérer un client par son ID
 * ==========================================
 *
 * GET /api/clients/:id
 *
 * Retourne les informations d'un client spécifique
 */

export default defineEventHandler(async (event) => {
  try {
    const id = parseInt(getRouterParam(event, 'id') || '0')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID client invalide',
      })
    }

    // Récupérer le client
    const [client] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1)

    if (!client) {
      throw createError({
        statusCode: 404,
        message: 'Client non trouvé',
      })
    }

    return {
      success: true,
      client,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du client:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
