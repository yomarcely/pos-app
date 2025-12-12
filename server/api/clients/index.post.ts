import { db } from '~/server/database/connection'
import { customers, customerEstablishments, establishments } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createClientSchema, type CreateClientInput } from '~/server/validators/customer.schema'
import { syncCustomerToGroup } from '~/server/utils/sync'
import { and, eq } from 'drizzle-orm'

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
    const parseEstablishmentId = (value: any) => {
      if (Array.isArray(value)) return parseEstablishmentId(value[0])
      const num = Number(value)
      return Number.isFinite(num) ? num : undefined
    }

    const headers = event.node.req.headers || {}
    const headerCandidates = ['x-establishment-id', 'establishment-id', 'establishmentid', 'x-establishment']
    let establishmentIdFromHeader: number | undefined
    for (const key of headerCandidates) {
      if (key in headers) {
        establishmentIdFromHeader = parseEstablishmentId(headers[key])
        if (establishmentIdFromHeader) break
      }
    }
    if (!establishmentIdFromHeader) {
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase().includes('establishment')) {
          establishmentIdFromHeader = parseEstablishmentId(v)
          if (establishmentIdFromHeader) break
        }
      }
    }

    const body = await validateBody<CreateClientInput>(event, createClientSchema)
    const establishmentIdFromBody = parseEstablishmentId((body as any).establishmentId)
    const establishmentIdFromQuery = parseEstablishmentId((query as any).establishmentId)

    const cookieCandidates = [
      getCookie(event, 'pos_selected_establishment'),
      getCookie(event, 'establishmentId'),
      getCookie(event, 'establishment_id'),
    ]
    const establishmentIdFromCookie = cookieCandidates
      .map(parseEstablishmentId)
      .find(id => !!id)

    let establishmentId = establishmentIdFromQuery
      ?? establishmentIdFromBody
      ?? establishmentIdFromHeader
      ?? establishmentIdFromCookie

    if (!establishmentId) {
      const estabs = await db
        .select({ id: establishments.id })
        .from(establishments)
        .where(eq(establishments.tenantId, tenantId))
        .limit(2)
      if (estabs.length === 1) {
        establishmentId = estabs[0].id
      }
    }

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

    // Lier le client à l'établissement source (même hors synchro)
    if (establishmentId) {
      const existingLink = await db
        .select({ id: customerEstablishments.id })
        .from(customerEstablishments)
        .where(
          and(
            eq(customerEstablishments.tenantId, tenantId),
            eq(customerEstablishments.customerId, newClient.id),
            eq(customerEstablishments.establishmentId, establishmentId)
          )
        )
        .limit(1)

      if (existingLink.length === 0) {
        await db.insert(customerEstablishments).values({
          tenantId,
          customerId: newClient.id,
          establishmentId,
          localDiscount: null,
          localNotes: null,
          localLoyaltyPoints: 0,
          firstPurchaseDate: null,
          lastPurchaseDate: null,
          totalPurchases: '0',
          purchaseCount: 0,
        })
      }
    }

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
