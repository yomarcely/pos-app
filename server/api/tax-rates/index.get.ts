import { desc, eq, and } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { taxRates } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * GET /api/tax-rates
 * Récupère la liste des taux de TVA
 */
export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event)

  // Récupérer les taux de TVA non archivés par défaut
  const includeArchived = getQuery(event).includeArchived === 'true'

  const where = includeArchived
    ? eq(taxRates.tenantId, tenantId)
    : and(
        eq(taxRates.tenantId, tenantId),
        eq(taxRates.isArchived, false)
      )

  const rates = await db
    .select()
    .from(taxRates)
    .where(where)
    .orderBy(desc(taxRates.isDefault), taxRates.rate)

  return rates
})
