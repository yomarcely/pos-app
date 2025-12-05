import { z } from 'zod'

/**
 * ==========================================
 * Schémas de validation Zod pour les marques
 * ==========================================
 */

export const createBrandSchema = z.object({
  name: z.string().min(1, 'Le nom de la marque est requis').max(255),
  description: z.string().max(1000).optional().nullable(),
  isArchived: z.boolean().default(false),
})

export const updateBrandSchema = createBrandSchema.partial()

export type CreateBrandInput = z.infer<typeof createBrandSchema>
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>
