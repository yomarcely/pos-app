import { z } from 'zod'

/**
 * ==========================================
 * SCHÉMAS DE VALIDATION - VENDEURS
 * ==========================================
 */

// Schéma de création d'un vendeur
export const createSellerSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long'),
  code: z.string().max(20, 'Le code est trop long').optional().nullable(),
  isActive: z.boolean().default(true),
})

// Schéma de mise à jour d'un vendeur
export const updateSellerSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long').optional(),
  code: z.string().max(20, 'Le code est trop long').optional().nullable(),
  isActive: z.boolean().optional(),
})

// Types TypeScript
export type CreateSellerInput = z.infer<typeof createSellerSchema>
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>
