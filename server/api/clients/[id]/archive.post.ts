import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logEntityDeactivation } from '~/server/utils/audit'

/**
 * POST /api/clients/:id/archive
 * Archive un client (soft delete, comme les produits)
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, message: 'ID du client manquant' })
    }

    const customerId = parseInt(id)

    const [client] = await db
      .update(customers)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.tenantId, tenantId)
        )
      )
      .returning()

    if (!client) {
      throw createError({ statusCode: 404, message: 'Client non trouvé' })
    }

    const clientName = [client.firstName, client.lastName].filter(Boolean).join(' ') || `Client #${customerId}`
    logger.info({ customerId, clientName }, 'Client archivé')

    // Audit log (soft delete via archive)
    const auth = event.context.auth
    await logEntityDeactivation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'customer',
      entityId: customerId,
      snapshot: { name: clientName },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Client archivé avec succès',
      client: { id: client.id, firstName: client.firstName, lastName: client.lastName },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de l\'archivage du client')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
