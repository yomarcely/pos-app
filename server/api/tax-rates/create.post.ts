import { eq, and } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { taxRates } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createTaxRateSchema } from '~/server/validators/tax-rate.schema'

/**
 * POST /api/tax-rates/create
 * Crée un nouveau taux de TVA
 */
export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event)

  // Valider les données
  const validatedData = await validateBody(event, createTaxRateSchema)

  // Si isDefault est true, désactiver les autres taux par défaut
  if (validatedData.isDefault) {
    await db
      .update(taxRates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(taxRates.tenantId, tenantId),
          eq(taxRates.isDefault, true)
        )
      )
  }

  // Créer le taux de TVA
  const [newTaxRate] = await db
    .insert(taxRates)
    .values({
      tenantId,
      name: validatedData.name,
      rate: validatedData.rate,
      code: validatedData.code,
      description: validatedData.description || null,
      isDefault: validatedData.isDefault,
    })
    .returning()

  return newTaxRate
})
