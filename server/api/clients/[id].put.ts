import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createClientSchema, type CreateClientInput } from '~/server/validators/customer.schema'
import { logger } from '~/server/utils/logger'
import { logEntityUpdate } from '~/server/utils/audit'

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

    // Vérifier l'unicité de l'email pour ce tenant (exclure le client en cours)
    if (body.email) {
      const duplicateEmail = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(
          eq(customers.email, body.email),
          eq(customers.tenantId, tenantId)
        ))
        .limit(1)
      if (duplicateEmail.length > 0 && duplicateEmail[0]!.id !== id) {
        throw createError({
          statusCode: 409,
          message: 'Un client avec cet email existe déjà'
        })
      }
    }

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

    // Q12 — Audit log
    if (updatedClient) {
      const auth = event.context.auth
      await logEntityUpdate({
        tenantId,
        userId: null,
        userName: auth?.user?.email || 'Utilisateur',
        entityType: 'customer',
        entityId: id,
        changes: {
          firstName: updatedClient.firstName,
          lastName: updatedClient.lastName,
          email: updatedClient.email,
          phone: updatedClient.phone,
          gdprConsent: updatedClient.gdprConsent,
        },
        ipAddress: getRequestIP(event) || null,
      })
    }

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
      message: "Une erreur interne s'est produite",
    })
  }
})
