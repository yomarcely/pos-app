import { db } from '~/server/database/connection'
import { customers, sales } from '~/server/database/schema'
import { desc, or, like, sql, sum } from 'drizzle-orm'

/**
 * ==========================================
 * API: Récupérer les clients avec recherche
 * ==========================================
 *
 * GET /api/clients?search=...
 *
 * Retourne la liste des clients avec support de recherche
 * Inclut le chiffre d'affaire total de chaque client
 */

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const searchTerm = query.search as string | undefined

    // Base query avec métadata pour extraire la ville
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
      })
      .from(customers)

    // Appliquer la recherche si présente
    if (searchTerm && searchTerm.trim() !== '') {
      const searchPattern = `%${searchTerm.trim()}%`
      queryBuilder = queryBuilder.where(
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

    // Calculer le CA total pour chaque client
    const clientsWithCA = await Promise.all(
      allClients.map(async (client) => {
        // Récupérer le CA total du client (uniquement ventes completed)
        const caResult = await db
          .select({
            totalCA: sum(sales.totalTTC),
          })
          .from(sales)
          .where(
            sql`${sales.customerId} = ${client.id} AND ${sales.status} = 'completed'`
          )

        const metadata = client.metadata as any || {}

        return {
          ...client,
          city: metadata.city || null,
          totalRevenue: caResult[0]?.totalCA ? parseFloat(caResult[0].totalCA as string) : 0,
          loyaltyPoints: 0, // TODO: implémenter le système de points
        }
      })
    )

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
