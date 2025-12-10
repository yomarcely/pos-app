import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createClientSchema, type CreateClientInput } from '~/server/validators/customer.schema'
import { syncCustomerToGroup } from '~/server/utils/sync'

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
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined
    const body = await validateBody<CreateClientInput>(event, createClientSchema)

    // Préparer les données
    const now = new Date()
    const clientData = {
      tenantId,
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      gdprConsent: body.gdprConsent,
      gdprConsentDate: body.gdprConsent ? now : null,
      marketingConsent: !!body.marketingConsent,
      loyaltyProgram: !!body.loyaltyProgram,
      discount: body.discount !== undefined ? String(body.discount) : '0',
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

    // Synchroniser le client vers les autres établissements du groupe si un establishmentId est fourni
    if (establishmentId) {
      try {
        await syncCustomerToGroup(tenantId, newClient.id, establishmentId)
        console.log(`✅ Client ${newClient.id} synchronisé depuis l'établissement ${establishmentId}`)
      } catch (syncError) {
        console.error('❌ Erreur lors de la synchronisation du client:', syncError)
        // On ne bloque pas la création, juste un warning
      }
    }

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
