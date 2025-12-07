import { eq, and } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { taxRates } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateTaxRateSchema } from '~/server/validators/tax-rate.schema'

/**
 * PATCH /api/tax-rates/:id/update
 * Met à jour un taux de TVA existant
 */
export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event)
  const id = Number(event.context.params?.id)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID manquant',
    })
  }

  // Valider les données
  const validatedData = await validateBody(event, updateTaxRateSchema)

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

  // Mettre à jour le taux de TVA
  const [updatedTaxRate] = await db
    .update(taxRates)
    .set({
      ...validatedData,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(taxRates.id, id),
        eq(taxRates.tenantId, tenantId)
      )
    )
    .returning()

  if (!updatedTaxRate) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Taux de TVA introuvable',
    })
  }

  return updatedTaxRate
})
