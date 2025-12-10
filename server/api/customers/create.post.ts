import { db } from '~/server/database/connection'
import { customers, auditLogs } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { createCustomerSchema, type CreateCustomerInput } from '~/server/validators/customer.schema'
import { validateBody } from '~/server/utils/validation'
import { syncCustomerToGroup } from '~/server/utils/sync'

/**
 * ==========================================
 * API: Créer un nouveau client (RGPD conforme)
 * ==========================================
 *
 * POST /api/customers/create
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    // Validation avec Zod
    const body = await validateBody<CreateCustomerInput>(event, createCustomerSchema)

    // ==========================================
    // 1. ENREGISTRER LE CLIENT EN BDD
    // ==========================================

    const [newCustomer] = await db
      .insert(customers)
      .values({
        tenantId,
        firstName: body.name,
        lastName: body.lastname,
        address: body.address || null,
        phone: body.phonenumber || null,
        email: body.mail || null,

        // RGPD - Le consentement est donné lors de la création
        gdprConsent: true,
        gdprConsentDate: new Date(),
        marketingConsent: body.authorizemailing || false,

        // Programme de fidélité
        loyaltyProgram: body.fidelity || false,
        discount: body.discount !== undefined ? String(body.discount) : '0',

        // Informations additionnelles
        notes: body.information || null,
        alerts: body.alert || null,

        // Métadonnées
        metadata: {
          postalcode: body.postalcode,
          city: body.city,
          country: body.country || 'France',
          authorizesms: body.authorizesms || false,
        },
      })
      .returning()

    // ==========================================
    // 2. LOG D'AUDIT RGPD
    // ==========================================

    await db.insert(auditLogs).values({
      tenantId,
      userId: 1, // TODO: Récupérer l'ID du vendeur connecté
      userName: 'System',
      entityType: 'customer',
      entityId: newCustomer.id,
      action: 'create',
      changes: {
        firstName: body.name,
        lastName: body.lastname,
        gdprConsent: true,
      },
      metadata: {
        consentDate: new Date().toISOString(),
        marketingConsent: body.authorizemailing || false,
      },
      ipAddress: getRequestIP(event) || null,
    })

    // ==========================================
    // 3. SYNCHRONISER VERS LES AUTRES ÉTABLISSEMENTS
    // ==========================================

    if (establishmentId) {
      try {
        await syncCustomerToGroup(tenantId, newCustomer.id, establishmentId)
        console.log(`✅ Client ${newCustomer.id} synchronisé depuis l'établissement ${establishmentId}`)
      } catch (syncError) {
        console.error('❌ Erreur lors de la synchronisation du client:', syncError)
        // On ne bloque pas la création, juste un warning
      }
    }

    // ==========================================
    // 4. RETOURNER LA RÉPONSE
    // ==========================================

    return {
      success: true,
      customer: {
        id: newCustomer.id,
        name: newCustomer.firstName,
        lastname: newCustomer.lastName,
        email: newCustomer.email,
        phone: newCustomer.phone,
        discount: parseFloat(newCustomer.discount || '0'),
        fidelity: newCustomer.loyaltyProgram,
      },
    }
  } catch (error) {
    console.error('Erreur lors de la création du client:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
