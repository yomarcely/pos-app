import { db } from '~/server/database/connection'
import { customers, auditLogs } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

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
        updatedAt: now,
      })
      .where(eq(customers.id, id))
      .returning()

    // Log d'audit RGPD
    const auth = event.context.auth
    await db.insert(auditLogs).values({
      tenantId,
      userId: null,
      userName: auth?.user?.email || auth?.user?.user_metadata?.name || 'Utilisateur',
      entityType: 'customer',
      entityId: id,
      action: 'customer_anonymized',
      changes: {
        firstName: { old: client.firstName, new: 'Anonyme' },
        lastName: { old: client.lastName, new: 'Client' },
        email: { old: client.email, new: null },
        phone: { old: client.phone, new: null },
        address: { old: client.address, new: null },
      },
      metadata: {
        anonymizedAt: now.toISOString(),
        reason: 'RGPD - droit à l\'oubli',
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
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
