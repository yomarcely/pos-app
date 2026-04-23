import { z } from 'zod'

/**
 * Schémas de validation Zod pour les archives NF525
 */

export const createArchiveSchema = z.object({
  type: z.enum(['monthly', 'yearly'], {
    message: 'Le type doit être "monthly" ou "yearly"',
  }),
  period: z.string().min(4, 'Période requise (YYYY ou YYYY-MM)'),
  registerId: z.number().int().positive().optional(),
}).refine(
  (data) => {
    if (data.type === 'monthly') return /^\d{4}-(0[1-9]|1[0-2])$/.test(data.period)
    return /^\d{4}$/.test(data.period)
  },
  {
    message: 'Format de période invalide (attendu YYYY-MM pour monthly, YYYY pour yearly)',
    path: ['period'],
  },
)

export type CreateArchiveInput = z.infer<typeof createArchiveSchema>
