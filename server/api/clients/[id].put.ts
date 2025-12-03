import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

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
    const id = parseInt(getRouterParam(event, 'id') || '0')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID client invalide',
      })
    }

    const body = await readBody(event)

    // Validation
    if (!body.gdprConsent) {
      throw createError({
        statusCode: 400,
        message: 'Le consentement RGPD est obligatoire',
      })
    }

    // Vérifier si le client existe
    const [existingClient] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
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
    console.error('Erreur lors de la mise à jour du client:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
