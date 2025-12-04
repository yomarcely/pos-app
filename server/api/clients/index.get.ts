import { db } from '~/server/database/connection'
import { customers, sales } from '~/server/database/schema'
import { desc, or, like, sql, eq } from 'drizzle-orm'

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
    const query = getQuery(event)
    const searchTerm = query.search as string | undefined

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
      .leftJoin(sales, eq(customers.id, sales.customerId))
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

    // Appliquer la recherche si présente
    if (searchTerm && searchTerm.trim() !== '') {
      const searchPattern = `%${searchTerm.trim()}%`
      queryBuilder = queryBuilder.having(
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
    const allClients = await queryBuilder.orderBy(desc(customers.createdAt))

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
    console.error('Erreur lors de la récupération des clients:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
