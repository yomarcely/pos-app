import { db } from '~/server/database/connection'
import { customers, customerEstablishments, syncGroupEstablishments } from '~/server/database/schema'
import { desc, eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Récupérer tous les clients
 * ==========================================
 *
 * GET /api/customers
 *
 * Retourne la liste complète des clients avec leurs informations
 * conformes au RGPD
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    if (establishmentId) {
      const syncLink = await db
        .select({ id: syncGroupEstablishments.id })
        .from(syncGroupEstablishments)
        .where(
          and(
            eq(syncGroupEstablishments.tenantId, tenantId),
            eq(syncGroupEstablishments.establishmentId, establishmentId)
          )
        )
        .limit(1)

      if (syncLink.length === 0) {
        return { success: true, customers: [], count: 0 }
      }
    }

    // Récupérer tous les clients, triés par date de création (plus récents en premier)
    const baseSelect = {
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      address: customers.address,
      discount: customers.discount,
      loyaltyProgram: customers.loyaltyProgram,
      gdprConsent: customers.gdprConsent,
      marketingConsent: customers.marketingConsent,
      notes: customers.notes,
      alerts: customers.alerts,
      metadata: customers.metadata,
      createdAt: customers.createdAt,
    }

    const allCustomers = establishmentId
      ? await db
        .select(baseSelect)
        .from(customers)
        .innerJoin(
          customerEstablishments,
          and(
            eq(customerEstablishments.customerId, customers.id),
            eq(customerEstablishments.establishmentId, establishmentId),
            eq(customerEstablishments.tenantId, tenantId)
          )
        )
        .where(eq(customers.tenantId, tenantId))
        .orderBy(desc(customers.createdAt))
      : await db
        .select(baseSelect)
        .from(customers)
        .where(eq(customers.tenantId, tenantId))
        .orderBy(desc(customers.createdAt))

    // Transformer les données pour correspondre au format attendu par le frontend
    const formattedCustomers = allCustomers.map(customer => {
      const metadata = customer.metadata as any || {}

      return {
        id: customer.id,
        name: customer.firstName,
        lastname: customer.lastName,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        postalcode: metadata.postalcode || '',
        city: metadata.city || '',
        country: metadata.country || 'France',
        phonenumber: customer.phone || '',
        mail: customer.email || '',
        fidelity: customer.loyaltyProgram || false,
        authorizesms: metadata.authorizesms || false,
        authorizemailing: customer.marketingConsent || false,
        discount: parseFloat(customer.discount || '0'),
        alert: customer.alerts || '',
        information: customer.notes || '',
        points: 0,
        createdAt: customer.createdAt,
      }
    })

    return {
      success: true,
      customers: formattedCustomers,
      count: formattedCustomers.length,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des clients:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
