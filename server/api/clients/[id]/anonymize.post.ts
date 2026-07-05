import { db } from '~/server/database/connection'
import { customers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logCustomerAnonymization } from '~/server/utils/audit'

/**
 * POST /api/clients/:id/anonymize
 *
 * Anonymise un client (RGPD - droit à l'oubli).
 * Efface toutes les données personnelles identifiables,
 * conserve les données de vente et statistiques.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const id = parseInt(getRouterParam(event, 'id') || '0')

    if (!id) {
      throw createError({ statusCode: 400, message: 'ID client invalide' })
    }

    // Vérifier que le client existe et appartient au tenant
    const [client] = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.id, id),
        eq(customers.tenantId, tenantId)
      ))
      .limit(1)

    if (!client) {
      throw createError({ statusCode: 404, message: 'Client non trouvé' })
    }

    if (client.isAnonymized) {
      throw createError({ statusCode: 409, message: 'Ce client est déjà anonymisé' })
    }

    const now = new Date()

    // Anonymiser les données personnelles
    const [updatedClient] = await db
      .update(customers)
      .set({
        firstName: 'Anonyme',
        lastName: 'Client',
        email: null,
        phone: null,
        address: null,
        notes: null,
        alerts: null,
        metadata: {},
        gdprConsent: false,
        gdprConsentDate: null,
        marketingConsent: false,
        isAnonymized: true,
        anonymizedAt: now,
        // Un client anonymisé (droit à l'oubli) n'a plus vocation à apparaître
        // dans les listes actives : il est archivé dans la foulée.
        isArchived: true,
        archivedAt: now,
        updatedAt: now,
      })
      .where(eq(customers.id, id))
      .returning()

    // Q9 — Log d'audit RGPD via le helper centralisé (snapshot avant anonymisation)
    const auth = event.context.auth
    await logCustomerAnonymization({
      tenantId,
      userId: null,
      userName: auth?.user?.email || auth?.user?.user_metadata?.name || 'Utilisateur',
      customerId: id,
      snapshot: {
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        address: client.address,
      },
      ipAddress: getRequestIP(event) || null,
    })

    logger.info({ customerId: id, tenantId }, 'Customer anonymized (GDPR)')

    return {
      success: true,
      client: updatedClient,
      message: 'Client anonymisé avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to anonymize customer')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
