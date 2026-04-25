import { eq } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { loyaltyConfig } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * GET /api/loyalty/config
 * Récupère la configuration de fidélité du tenant.
 * Si aucune config n'existe : retourne des valeurs par défaut (enabled=false).
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    const [existing] = await db
      .select()
      .from(loyaltyConfig)
      .where(eq(loyaltyConfig.tenantId, tenantId))
      .limit(1)

    if (existing) {
      return {
        success: true,
        config: {
          enabled: existing.enabled,
          pointMode: existing.pointMode,
          thresholdPoints: existing.thresholdPoints,
          rewardType: existing.rewardType,
          rewardValue: parseFloat(existing.rewardValue),
          voucherValidityDays: existing.voucherValidityDays,
        },
      }
    }

    // Pas de config persistée → défauts (programme désactivé)
    return {
      success: true,
      config: {
        enabled: false,
        pointMode: 'per_euro' as const,
        thresholdPoints: 100,
        rewardType: 'percent_discount' as const,
        rewardValue: 5,
        voucherValidityDays: 60,
      },
    }
  }
  catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération de la config fidélité')
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
