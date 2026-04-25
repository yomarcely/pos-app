import { z } from 'zod'

/**
 * ==========================================
 * Schémas de validation Zod — Programme de fidélité
 * ==========================================
 */

export const POINT_MODES = ['per_euro', 'per_ticket'] as const
export const REWARD_TYPES = ['percent_discount', 'euro_discount', 'voucher'] as const

export const updateLoyaltyConfigSchema = z.object({
  enabled: z.boolean(),
  pointMode: z.enum(POINT_MODES),
  thresholdPoints: z.number().int().min(1, 'Le seuil doit être ≥ 1'),
  rewardType: z.enum(REWARD_TYPES),
  rewardValue: z.number().positive('La valeur de la récompense doit être > 0'),
  voucherValidityDays: z.number().int().min(1, 'La validité doit être ≥ 1 jour').max(3650, 'La validité ne peut pas dépasser 10 ans'),
}).superRefine((data, ctx) => {
  // % cap à 100
  if (data.rewardType === 'percent_discount' && data.rewardValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rewardValue'],
      message: 'Une remise en % ne peut pas dépasser 100',
    })
  }
})

export type UpdateLoyaltyConfigInput = z.infer<typeof updateLoyaltyConfigSchema>
