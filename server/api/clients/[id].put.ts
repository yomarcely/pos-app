import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createClientSchema, type CreateClientInput } from '~/server/validators/customer.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Mettre à jour un client
 * ==========================================
 *
 * PUT /api/clients/:id
 *
 * Met à jour les informations d'un client existant
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

    const body = await validateBody<CreateClientInput>(event, createClientSchema)

    // Vérifier si le client existe
    const [existingClient] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, id),
          eq(customers.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!existingClient) {
      throw createError({
        statusCode: 404,
        message: 'Client non trouvé',
      })
    }

    // Préparer les données de mise à jour
    const now = new Date()
    const updateData = {
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      gdprConsent: body.gdprConsent,
      gdprConsentDate: body.gdprConsent && !existingClient.gdprConsentDate ? now : existingClient.gdprConsentDate,
      marketingConsent: !!body.marketingConsent,
      loyaltyProgram: !!body.loyaltyProgram,
      discount: body.discount?.toString() || '0',
      notes: body.notes || null,
      alerts: body.alerts || null,
      metadata: body.metadata || {},
      updatedAt: now,
    }

    // Mettre à jour le client
    const [updatedClient] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, id))
      .returning()

    return {
      success: true,
      client: updatedClient,
      message: 'Client mis à jour avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la mise à jour du client')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
