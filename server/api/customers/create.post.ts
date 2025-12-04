import { db } from '~/server/database/connection'
import { customers, auditLogs } from '~/server/database/schema'

/**
 * ==========================================
 * API: Créer un nouveau client (RGPD conforme)
 * ==========================================
 *
 * POST /api/customers/create
 *
 * Corps de la requête:
 * {
 *   name: string,
 *   lastname: string,
 *   address?: string,
 *   postalcode?: string,
 *   city?: string,
 *   country?: string,
 *   phonenumber?: string,
 *   mail?: string,
 *   fidelity?: boolean,
 *   authorizesms?: boolean,
 *   authorizemailing?: boolean,
 *   discount?: number,
 *   alert?: string,
 *   information?: string
 * }
 */

interface CreateCustomerRequest {
  name: string
  lastname: string
  address?: string
  postalcode?: string
  city?: string
  country?: string
  phonenumber?: string
  mail?: string
  fidelity?: boolean
  authorizesms?: boolean
  authorizemailing?: boolean
  discount?: number
  alert?: string
  information?: string
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    const body = await readBody<CreateCustomerRequest>(event)

    // Validation des données obligatoires
    if (!body.name || !body.lastname || !body.postalcode) {
      throw createError({
        statusCode: 400,
        message: 'Le nom, le prénom et le code postal sont obligatoires',
      })
    }

    // Validation de l'email si fourni
    if (body.mail && !body.mail.includes('@')) {
      throw createError({
        statusCode: 400,
        message: 'Adresse email invalide',
      })
    }

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
        discount: body.discount?.toString() || '0',

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
    // 3. RETOURNER LA RÉPONSE
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
