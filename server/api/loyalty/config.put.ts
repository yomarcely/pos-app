import { eq } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { loyaltyConfig } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { updateLoyaltyConfigSchema } from '~/server/validators/loyalty.schema'
import { logger } from '~/server/utils/logger'
import { logEntityCreation, logEntityUpdate } from '~/server/utils/audit'
import { getRequestIP } from 'h3'

/**
 * PUT /api/loyalty/config
 * Met à jour (ou crée si absent) la configuration fidélité du tenant.
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const data = await validateBody(event, updateLoyaltyConfigSchema)
    const userId = event.context.auth?.user?.id ? Number(event.context.auth.user.id) : null
    const userName = event.context.auth?.user?.email ?? null
    const ipAddress = getRequestIP(event) ?? null

    const [existing] = await db
      .select()
      .from(loyaltyConfig)
      .where(eq(loyaltyConfig.tenantId, tenantId))
      .limit(1)

    if (existing) {
      const [updated] = await db
        .update(loyaltyConfig)
        .set({
          enabled: data.enabled,
          pointMode: data.pointMode,
          thresholdPoints: data.thresholdPoints,
          rewardType: data.rewardType,
          rewardValue: String(data.rewardValue),
          voucherValidityDays: data.voucherValidityDays,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyConfig.tenantId, tenantId))
        .returning()

      if (!updated) {
        throw createError({ statusCode: 500, message: 'Échec de la mise à jour' })
      }

      await logEntityUpdate({
        tenantId,
        userId,
        userName,
        entityType: 'loyalty_config',
        entityId: updated.id,
        changes: data,
        ipAddress,
      })

      return {
        success: true,
        config: {
          enabled: updated.enabled,
          pointMode: updated.pointMode,
          thresholdPoints: updated.thresholdPoints,
          rewardType: updated.rewardType,
          rewardValue: parseFloat(updated.rewardValue),
          voucherValidityDays: updated.voucherValidityDays,
        },
      }
    }

    const [created] = await db
      .insert(loyaltyConfig)
      .values({
        tenantId,
        enabled: data.enabled,
        pointMode: data.pointMode,
        thresholdPoints: data.thresholdPoints,
        rewardType: data.rewardType,
        rewardValue: String(data.rewardValue),
        voucherValidityDays: data.voucherValidityDays,
      })
      .returning()

    if (!created) {
      throw createError({ statusCode: 500, message: 'Échec de la création' })
    }

    await logEntityCreation({
      tenantId,
      userId,
      userName,
      entityType: 'loyalty_config',
      entityId: created.id,
      snapshot: data,
      ipAddress,
    })

    return {
      success: true,
      config: {
        enabled: created.enabled,
        pointMode: created.pointMode,
        thresholdPoints: created.thresholdPoints,
        rewardType: created.rewardType,
        rewardValue: parseFloat(created.rewardValue),
        voucherValidityDays: created.voucherValidityDays,
      },
    }
  }
  catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error
    logger.error({ err: error }, 'Erreur lors de la mise à jour de la config fidélité')
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
