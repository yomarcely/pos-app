import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { customers, loyaltyVouchers } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { getActiveLoyaltyConfig, getCustomerLoyaltyPoints } from '~/server/utils/loyalty'

/**
 * GET /api/clients/:id/loyalty-status?establishmentId=X
 *
 * Retourne l'état fidélité d'un client pour la caisse :
 * - points actuels (cumulés cross-établissement si syncLoyaltyProgram=true)
 * - seuil + type d'avantage configuré
 * - éligibilité au reward (si type ≠ voucher)
 * - liste des bons d'achat actifs (status='active' ET non expirés)
 *
 * Si pas de config, ou config désactivée, ou client sans loyaltyProgram :
 * retourne `{ enabled: false }` (caisse n'affiche rien).
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const customerId = parseInt(getRouterParam(event, 'id') || '0', 10)
    const establishmentId = Number(getQuery(event).establishmentId) || null

    if (!customerId || !establishmentId) {
      throw createError({ statusCode: 400, message: 'customerId et establishmentId requis' })
    }

    const config = await getActiveLoyaltyConfig(tenantId)
    if (!config) return { success: true, enabled: false }

    const [customerRow] = await db
      .select({ id: customers.id, loyaltyProgram: customers.loyaltyProgram })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
      .limit(1)

    if (!customerRow) {
      throw createError({ statusCode: 404, message: 'Client introuvable' })
    }
    if (!customerRow.loyaltyProgram) {
      return { success: true, enabled: false, optedIn: false }
    }

    const pointsCurrent = await getCustomerLoyaltyPoints(tenantId, customerId, establishmentId)

    // Avantage immédiat (% / €) : éligible si points >= seuil ET reward != voucher
    // Pour voucher : on n'auto-déclenche pas, l'utilisateur consomme via "redeem" séparé
    const immediateRewardEligible = pointsCurrent >= config.thresholdPoints
      && config.rewardType !== 'voucher'

    // Vouchers actifs (non expirés)
    const now = new Date()
    const activeVouchers = await db
      .select({
        id: loyaltyVouchers.id,
        code: loyaltyVouchers.code,
        amount: loyaltyVouchers.amount,
        expiresAt: loyaltyVouchers.expiresAt,
        createdAt: loyaltyVouchers.createdAt,
      })
      .from(loyaltyVouchers)
      .where(
        and(
          eq(loyaltyVouchers.tenantId, tenantId),
          eq(loyaltyVouchers.customerId, customerId),
          eq(loyaltyVouchers.status, 'active'),
          or(isNull(loyaltyVouchers.expiresAt), gt(loyaltyVouchers.expiresAt, now)),
        ),
      )
      .orderBy(asc(loyaltyVouchers.expiresAt))

    return {
      success: true,
      enabled: true,
      optedIn: true,
      pointsCurrent,
      pointsRequired: config.thresholdPoints,
      pointsRemaining: Math.max(0, config.thresholdPoints - pointsCurrent),
      rewardType: config.rewardType,
      rewardValue: config.rewardValue,
      immediateRewardEligible,
      vouchers: activeVouchers.map(v => ({
        id: v.id,
        code: v.code,
        amount: parseFloat(v.amount),
        expiresAt: v.expiresAt,
        createdAt: v.createdAt,
      })),
    }
  }
  catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error
    logger.error({ err: error }, 'Erreur loyalty-status')
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
