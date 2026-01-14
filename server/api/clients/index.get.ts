import { db } from '~/server/database/connection'
import { customers, sales, customerEstablishments } from '~/server/database/schema'
import { desc, or, like, sql, eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer les clients avec recherche
 * ==========================================
 *
 * GET /api/clients?search=...
 *
 * Retourne la liste des clients avec support de recherche
 * Inclut le chiffre d'affaire total de chaque client
 *
 * Performance: Utilise un LEFT JOIN pour éviter N+1 queries
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const searchTerm = query.search as string | undefined
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    // Logique de visibilité des clients par établissement :
    // - Si l'établissement a une liaison avec un client (dans customer_establishments), il le voit
    // - Cela permet aux nouveaux établissements de démarrer vides
    // - Et aux établissements désynchro de garder leurs clients

    // Conditions de base
    const baseConditions = [eq(customers.tenantId, tenantId)]

    // Query optimisée avec LEFT JOIN pour calculer le CA en une seule requête
    let queryBuilder = db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        address: customers.address,
        metadata: customers.metadata,
        gdprConsent: customers.gdprConsent,
        gdprConsentDate: customers.gdprConsentDate,
        marketingConsent: customers.marketingConsent,
        loyaltyProgram: customers.loyaltyProgram,
        discount: customers.discount,
        notes: customers.notes,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        // Calculer le CA total directement avec LEFT JOIN
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${sales.status} = 'completed' THEN CAST(${sales.totalTTC} AS NUMERIC) ELSE 0 END), 0)`,
      })
      .from(customers)
      .leftJoin(sales, and(
        eq(customers.id, sales.customerId),
        eq(sales.tenantId, tenantId)
      ))

    // INNER JOIN pour ne retourner QUE les clients liés à cet établissement
    // Cela permet :
    // - Nouvel établissement = aucun client (pas de liaison)
    // - Établissement désynchro = garde ses clients (a toujours la liaison)
    if (establishmentId) {
      queryBuilder = queryBuilder
        .innerJoin(
          customerEstablishments,
          and(
            eq(customerEstablishments.customerId, customers.id),
            eq(customerEstablishments.establishmentId, establishmentId),
            eq(customerEstablishments.tenantId, tenantId)
          )
        )
      baseConditions.push(eq(customerEstablishments.establishmentId, establishmentId))
      baseConditions.push(eq(customerEstablishments.tenantId, tenantId))
    }

    // Appliquer les conditions avant le groupBy
    const groupedQuery = queryBuilder
      .where(and(...baseConditions))
      .groupBy(
        customers.id,
        customers.firstName,
        customers.lastName,
        customers.email,
        customers.phone,
        customers.address,
        customers.metadata,
        customers.gdprConsent,
        customers.gdprConsentDate,
        customers.marketingConsent,
        customers.loyaltyProgram,
        customers.discount,
        customers.notes,
        customers.createdAt,
        customers.updatedAt
      )

    let finalQuery = groupedQuery

    // Appliquer la recherche si présente
    if (searchTerm && searchTerm.trim() !== '') {
      const searchPattern = `%${searchTerm.trim()}%`
      finalQuery = finalQuery.having(
        or(
          like(customers.firstName, searchPattern),
          like(customers.lastName, searchPattern),
          like(customers.email, searchPattern),
          like(customers.phone, searchPattern),
          sql`CONCAT(${customers.firstName}, ' ', ${customers.lastName}) ILIKE ${searchPattern}`
        )
      ) as any
    }

    // Ordonner par date de création (plus récents en premier)
    const allClients = await finalQuery.orderBy(desc(customers.createdAt))

    // Transformer les résultats
    const clientsWithCA = allClients.map((client) => {
      const metadata = client.metadata as any || {}

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        address: client.address,
        metadata: client.metadata,
        gdprConsent: client.gdprConsent,
        gdprConsentDate: client.gdprConsentDate,
        marketingConsent: client.marketingConsent,
        loyaltyProgram: client.loyaltyProgram,
        discount: client.discount,
        notes: client.notes,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        city: metadata.city || null,
        totalRevenue: parseFloat(client.totalRevenue as string) || 0,
        loyaltyPoints: 0, // TODO: implémenter le système de points
      }
    })

    return {
      success: true,
      clients: clientsWithCA,
      count: clientsWithCA.length,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des clients')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
