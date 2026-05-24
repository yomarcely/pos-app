import { and, count, eq } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { establishments, products, registers, sellers, taxRates } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * GET /api/onboarding/status
 * Retourne l'avancement de l'onboarding pour le tenant courant
 * (combien d'établissements, caisses, vendeurs, TVA, produits actifs existent).
 *
 * Conformité NF525 : une caisse (register) par établissement est requise pour
 * pouvoir générer des tickets — donc obligatoire pour terminer l'onboarding.
 */
export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event)

  const [estCount, registerCount, sellerCount, taxCount, productCount] = await Promise.all([
    db
      .select({ c: count() })
      .from(establishments)
      .where(and(eq(establishments.tenantId, tenantId), eq(establishments.isActive, true))),
    db
      .select({ c: count() })
      .from(registers)
      .where(and(eq(registers.tenantId, tenantId), eq(registers.isActive, true))),
    db
      .select({ c: count() })
      .from(sellers)
      .where(and(eq(sellers.tenantId, tenantId), eq(sellers.isActive, true))),
    db
      .select({ c: count() })
      .from(taxRates)
      .where(and(eq(taxRates.tenantId, tenantId), eq(taxRates.isArchived, false))),
    db
      .select({ c: count() })
      .from(products)
      .where(eq(products.tenantId, tenantId)),
  ])

  const hasEstablishment = Number(estCount[0]?.c ?? 0) > 0
  const hasRegister = Number(registerCount[0]?.c ?? 0) > 0
  const hasSeller = Number(sellerCount[0]?.c ?? 0) > 0
  const hasTaxRate = Number(taxCount[0]?.c ?? 0) > 0
  const hasProduct = Number(productCount[0]?.c ?? 0) > 0

  const done = [hasEstablishment, hasRegister, hasSeller, hasTaxRate, hasProduct].filter(Boolean).length

  return {
    hasEstablishment,
    hasRegister,
    hasSeller,
    hasTaxRate,
    hasProduct,
    isComplete: done === 5,
    progress: { done, total: 5 },
  }
})
