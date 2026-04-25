import { db } from '~/server/database/connection'
import { customers, sales, customerEstablishments } from '~/server/database/schema'
import { desc, or, like, sql, eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { parsePaginationQuery, paginationMeta } from '~/server/utils/apiResponse'

/**
 * ==========================================
 * API: Récupérer les clients avec recherche
 * ==========================================
 *
 * GET /api/clients?search=...&page=1&limit=50
 *
 * Retourne la liste des clients avec support de recherche et pagination.
 * Inclut le chiffre d'affaire total de chaque client.
 *
 * Performance: LEFT JOIN pour éviter N+1, COUNT séparé pour la pagination.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const searchTerm = query.search as string | undefined
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined
    const { page, limit, offset } = parsePaginationQuery(event)

    // Logique de visibilité des clients par établissement :
    // - Si l'établissement a une liaison avec un client (dans customer_establishments), il le voit
    // - Cela permet aux nouveaux établissements de démarrer vides
    // - Et aux établissements désynchro de garder leurs clients

    // Conditions de base (WHERE) — incluent désormais le filtre search
    const baseConditions = [eq(customers.tenantId, tenantId)]

    if (searchTerm && searchTerm.trim() !== '') {
      const term = `%${searchTerm.trim()}%`
      const searchCondition = or(
        like(customers.firstName, term),
        like(customers.lastName, term),
        like(customers.email, term),
        like(customers.phone, term),
        sql`CONCAT(${customers.firstName}, ' ', ${customers.lastName}) ILIKE ${term}`,
      )
      if (searchCondition) baseConditions.push(searchCondition)
    }

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
        totalRevenue: sql<string>`COALESCE(SUM(DISTINCT CASE WHEN ${sales.status} = 'completed' THEN CAST(${sales.totalTTC} AS NUMERIC) ELSE 0 END), 0)`,
        // Sommer les points de fidélité depuis customerEstablishments
        loyaltyPoints: sql<number>`COALESCE(SUM(DISTINCT ${customerEstablishments.localLoyaltyPoints}), 0)`,
      })
      .from(customers)
      .leftJoin(sales, and(
        eq(customers.id, sales.customerId),
        eq(sales.tenantId, tenantId)
      ))

    // JOIN customerEstablishments pour récupérer les points de fidélité
    // - Avec establishmentId: INNER JOIN (ne retourne que les clients liés)
    // - Sans establishmentId: LEFT JOIN (retourne tous les clients avec somme des points)
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
    } else {
      queryBuilder = queryBuilder
        .leftJoin(
          customerEstablishments,
          and(
            eq(customerEstablishments.customerId, customers.id),
            eq(customerEstablishments.tenantId, tenantId)
          )
        )
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

    // Ordonner par date de création (plus récents en premier) + pagination
    const allClients = await groupedQuery
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset)

    // COUNT séparé pour la pagination — DISTINCT customers.id car le JOIN sales/CE
    // peut multiplier les lignes
    const countRow = establishmentId
      ? await db
          .select({ total: sql<number>`COUNT(DISTINCT ${customers.id})` })
          .from(customers)
          .innerJoin(
            customerEstablishments,
            and(
              eq(customerEstablishments.customerId, customers.id),
              eq(customerEstablishments.establishmentId, establishmentId),
              eq(customerEstablishments.tenantId, tenantId),
            ),
          )
          .where(and(...baseConditions))
      : await db
          .select({ total: sql<number>`COUNT(DISTINCT ${customers.id})` })
          .from(customers)
          .where(and(...baseConditions))
    const total = Number(countRow[0]?.total ?? 0)

    // Transformer les résultats
    type ClientMetadata = { city?: string }
    const clientsWithCA = allClients.map((client) => {
      const metadata = (client.metadata || {}) as ClientMetadata
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
        loyaltyPoints: client.loyaltyPoints ?? 0,
        discount: client.discount,
        notes: client.notes,
        city: metadata.city || null,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        totalRevenue: parseFloat(client.totalRevenue as string) || 0,
      }
    })

    return {
      success: true,
      clients: clientsWithCA,
      count: clientsWithCA.length,
      meta: {
        pagination: paginationMeta({ page, limit, total }),
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des clients')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
