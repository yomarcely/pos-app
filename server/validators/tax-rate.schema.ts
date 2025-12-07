import { z } from 'zod'

/**
 * ==========================================
 * Schémas de validation Zod pour les taux de TVA
 * ==========================================
 */

// Schéma pour la création d'un taux de TVA
export const createTaxRateSchema = z.object({
  name: z.string().min(1, 'Le nom du taux de TVA est requis').max(100),
  rate: z.string().or(z.number()).transform(val => String(val)),
  code: z.string().min(1, 'Le code TVA est requis').max(10).regex(/^[A-Z0-9]+$/, 'Le code doit contenir uniquement des lettres majuscules et des chiffres'),
  description: z.string().max(500).optional().nullable(),
  isDefault: z.boolean().default(false),
})

// Schéma pour la mise à jour d'un taux de TVA
export const updateTaxRateSchema = createTaxRateSchema.partial()

// Type TypeScript inféré du schéma
export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>
export type UpdateTaxRateInput = z.infer<typeof updateTaxRateSchema>
