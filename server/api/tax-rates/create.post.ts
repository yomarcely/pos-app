import { eq, and, count } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { taxRates } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { createTaxRateSchema } from '~/server/validators/tax-rate.schema'
import { logEntityCreation } from '~/server/utils/audit'

/**
 * POST /api/tax-rates/create
 * Crée un nouveau taux de TVA
 */
export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event)
  assertRole(event, 'admin')

  // Valider les données
  const validatedData = await validateBody(event, createTaxRateSchema)

  // Générer automatiquement le code NF525 (TVA_1, TVA_2, TVA_3…)
  const existingCount = await db
    .select({ count: count() })
    .from(taxRates)
    .where(eq(taxRates.tenantId, tenantId))
  const nextIndex = (existingCount[0]?.count ?? 0) + 1
  const generatedCode = `TVA_${nextIndex}`

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
      code: generatedCode,
      description: validatedData.description || null,
      isDefault: validatedData.isDefault,
    })
    .returning()

  // Q12 — Audit log (NF525 critique : création d'un taux de TVA)
  if (newTaxRate) {
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'tax_rate',
      entityId: newTaxRate.id,
      snapshot: {
        name: newTaxRate.name,
        rate: newTaxRate.rate,
        code: newTaxRate.code,
        isDefault: newTaxRate.isDefault,
      },
      ipAddress: getRequestIP(event) || null,
    })
  }

  return newTaxRate
})
