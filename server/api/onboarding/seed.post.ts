import { and, count, eq } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { establishments, sellerEstablishments, sellers, taxRates } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'

/**
 * POST /api/onboarding/seed
 *
 * Crée silencieusement le minimum nécessaire pour démarrer :
 *   - 1 vendeur (nom = name du compte, ou email si absent)
 *   - 3 taux de TVA français standards (20%, 10%, 5,5%) — codes NF525 TVA_1/2/3
 *
 * Idempotent : si un vendeur OU un taux de TVA existe déjà pour ce tenant,
 * la création correspondante est sautée. Aucun établissement n'est créé ici
 * — il doit être saisi explicitement (impact numérotation NF525).
 */

const DEFAULT_TAX_RATES: Array<{ name: string; rate: string; isDefault: boolean }> = [
  { name: 'Taux normal 20%', rate: '20.00', isDefault: true },
  { name: 'Taux intermédiaire 10%', rate: '10.00', isDefault: false },
  { name: 'Taux réduit 5,5%', rate: '5.50', isDefault: false },
]

export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event)
  const auth = event.context.auth
  const userName =
    (auth?.user?.user_metadata as Record<string, unknown> | undefined)?.name as string | undefined
  const userEmail = auth?.user?.email as string | undefined
  const sellerName = (userName?.trim() || userEmail?.split('@')[0] || 'Vendeur principal').slice(0, 100)

  const [existingSellers, existingTaxRates] = await Promise.all([
    db
      .select({ c: count() })
      .from(sellers)
      .where(eq(sellers.tenantId, tenantId)),
    db
      .select({ c: count() })
      .from(taxRates)
      .where(eq(taxRates.tenantId, tenantId)),
  ])

  const sellerCount = Number(existingSellers[0]?.c ?? 0)
  const taxCount = Number(existingTaxRates[0]?.c ?? 0)

  const created = { seller: false, taxRates: 0, sellerAttachments: 0 }
  const errors: string[] = []
  const ip = getRequestIP(event) || null
  const auditUserName = userEmail || userName || 'Utilisateur'

  logger.info(
    { tenantId, sellerCount, taxCount, sellerName, hasUserMetadataName: !!userName, hasUserEmail: !!userEmail },
    '[Onboarding seed] starting',
  )

  // ---- Vendeur ----
  if (sellerCount === 0) {
    try {
      const [newSeller] = await db
        .insert(sellers)
        .values({
          tenantId,
          name: sellerName,
          code: null,
          isActive: true,
        })
        .returning()

      if (newSeller) {
        created.seller = true
        logger.info({ tenantId, sellerId: newSeller.id, sellerName }, '[Onboarding seed] seller created')
        await logEntityCreation({
          tenantId,
          userId: null,
          userName: auditUserName,
          entityType: 'seller',
          entityId: newSeller.id,
          snapshot: {
            name: newSeller.name,
            isActive: newSeller.isActive,
            source: 'onboarding_seed',
          },
          ipAddress: ip,
        })
      } else {
        errors.push('seller: insert returned no row')
        logger.error({ tenantId }, '[Onboarding seed] seller insert returned no row')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`seller: ${msg}`)
      logger.error({ tenantId, err }, '[Onboarding seed] seller creation failed')
    }
  }

  // ---- Taux de TVA ----
  if (taxCount === 0) {
    for (let i = 0; i < DEFAULT_TAX_RATES.length; i++) {
      const tpl = DEFAULT_TAX_RATES[i]
      if (!tpl) continue
      try {
        const [newRate] = await db
          .insert(taxRates)
          .values({
            tenantId,
            name: tpl.name,
            rate: tpl.rate,
            code: `TVA_${i + 1}`,
            description: null,
            isDefault: tpl.isDefault,
          })
          .returning()

        if (newRate) {
          created.taxRates += 1
          await logEntityCreation({
            tenantId,
            userId: null,
            userName: auditUserName,
            entityType: 'tax_rate',
            entityId: newRate.id,
            snapshot: {
              name: newRate.name,
              rate: newRate.rate,
              code: newRate.code,
              isDefault: newRate.isDefault,
              source: 'onboarding_seed',
            },
            ipAddress: ip,
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`taxRate[${tpl.name}]: ${msg}`)
        logger.error({ tenantId, taxRate: tpl.name, err }, '[Onboarding seed] tax rate creation failed')
      }
    }
  }

  // ---- Rattachement vendeurs ↔ établissements ----
  // Pour chaque (vendeur actif, établissement actif) sans liaison, on insère dans
  // seller_establishments. Idempotent : skip les liaisons déjà présentes.
  try {
    const [allSellers, allEstablishments, existingLinks] = await Promise.all([
      db
        .select({ id: sellers.id })
        .from(sellers)
        .where(and(eq(sellers.tenantId, tenantId), eq(sellers.isActive, true))),
      db
        .select({ id: establishments.id })
        .from(establishments)
        .where(and(eq(establishments.tenantId, tenantId), eq(establishments.isActive, true))),
      db
        .select({ sellerId: sellerEstablishments.sellerId, establishmentId: sellerEstablishments.establishmentId })
        .from(sellerEstablishments)
        .where(eq(sellerEstablishments.tenantId, tenantId)),
    ])

    if (allSellers.length > 0 && allEstablishments.length > 0) {
      const existingSet = new Set(existingLinks.map(l => `${l.sellerId}:${l.establishmentId}`))
      const toInsert: Array<{ tenantId: string; sellerId: number; establishmentId: number }> = []

      for (const s of allSellers) {
        for (const e of allEstablishments) {
          if (!existingSet.has(`${s.id}:${e.id}`)) {
            toInsert.push({ tenantId, sellerId: s.id, establishmentId: e.id })
          }
        }
      }

      if (toInsert.length > 0) {
        await db.insert(sellerEstablishments).values(toInsert)
        created.sellerAttachments = toInsert.length
        logger.info(
          { tenantId, count: toInsert.length },
          '[Onboarding seed] seller-establishment links created',
        )
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`sellerAttachments: ${msg}`)
    logger.error({ tenantId, err }, '[Onboarding seed] seller attachments failed')
  }

  logger.info({ tenantId, created, errors }, '[Onboarding seed] done')

  return {
    success: errors.length === 0,
    created,
    alreadySeeded: sellerCount > 0 && taxCount > 0 && created.sellerAttachments === 0,
    errors,
  }
})
