import { db } from '~/server/database/connection'
import { customers, sales } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { logEntityDeletion } from '~/server/utils/audit'

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
    const tenantId = getTenantIdFromEvent(event)
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
      .where(
        and(
          eq(customers.id, id),
          eq(customers.tenantId, tenantId),
        )
      )
      .limit(1)

    if (existingClient.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Client non trouvé',
      })
    }

    // Un client avec des ventes ne peut pas être supprimé (traçabilité NF525) :
    // message explicite + invitation à archiver, plutôt qu'une erreur FK opaque.
    const [existingSale] = await db
      .select({ id: sales.id })
      .from(sales)
      .where(
        and(
          eq(sales.customerId, id),
          eq(sales.tenantId, tenantId),
        )
      )
      .limit(1)

    if (existingSale) {
      throw createError({
        statusCode: 409,
        message: 'Impossible de supprimer ce client : des ventes lui sont associées. Vous pouvez l\'archiver pour le masquer des listes tout en conservant son historique.',
      })
    }

    // Supprimer le client
    await db.delete(customers).where(
      and(
        eq(customers.id, id),
        eq(customers.tenantId, tenantId),
      )
    )

    // Q6 — Audit log de la suppression
    const client = existingClient[0]
    const auth = event.context.auth
    await logEntityDeletion({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'customer',
      entityId: id,
      snapshot: client ? {
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
      } : undefined,
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Client supprimé avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression du client')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
