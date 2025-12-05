import { z } from 'zod'

/**
 * ==========================================
 * Schémas de validation Zod pour les variations
 * ==========================================
 */

export const createVariationGroupSchema = z.object({
  name: z.string().min(1, 'Le nom du groupe est requis').max(255),
  isArchived: z.boolean().default(false),
})

export const updateVariationGroupSchema = createVariationGroupSchema.partial()

export const createVariationSchema = z.object({
  name: z.string().min(1, 'Le nom de la variation est requis').max(255),
  groupId: z.number().int().positive(),
  sortOrder: z.number().int().min(0).default(0),
  isArchived: z.boolean().default(false),
})

export const updateVariationSchema = createVariationSchema.partial()

export type CreateVariationGroupInput = z.infer<typeof createVariationGroupSchema>
export type UpdateVariationGroupInput = z.infer<typeof updateVariationGroupSchema>
export type CreateVariationInput = z.infer<typeof createVariationSchema>
export type UpdateVariationInput = z.infer<typeof updateVariationSchema>
