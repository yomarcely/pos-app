import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Supprimer un client
 * ==========================================
 *
 * DELETE /api/clients/:id
 *
 * Supprime un client de la base de données
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

    // Vérifier si le client existe
    const existingClient = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1)

    if (existingClient.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Client non trouvé',
      })
    }

    // Supprimer le client
    await db.delete(customers).where(eq(customers.id, id))

    return {
      success: true,
      message: 'Client supprimé avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du client:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
