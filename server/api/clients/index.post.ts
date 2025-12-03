import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'

/**
 * ==========================================
 * API: Créer un nouveau client
 * ==========================================
 *
 * POST /api/clients
 *
 * Crée un nouveau client dans la base de données
 */

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validation
    if (!body.gdprConsent) {
      throw createError({
        statusCode: 400,
        message: 'Le consentement RGPD est obligatoire',
      })
    }

    // Préparer les données
    const now = new Date()
    const clientData = {
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      gdprConsent: body.gdprConsent,
      gdprConsentDate: body.gdprConsent ? now : null,
      marketingConsent: !!body.marketingConsent,
      loyaltyProgram: !!body.loyaltyProgram,
      discount: body.discount?.toString() || '0',
      notes: body.notes || null,
      alerts: body.alerts || null,
      metadata: body.metadata || {},
      createdAt: now,
      updatedAt: now,
    }

    // Insérer le client
    const [newClient] = await db
      .insert(customers)
      .values(clientData)
      .returning()

    return {
      success: true,
      client: newClient,
      message: 'Client créé avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la création du client:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
