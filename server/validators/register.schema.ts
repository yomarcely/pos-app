import { z } from 'zod'

/**
 * ==========================================
 * SCHÉMAS DE VALIDATION - CAISSES (REGISTERS)
 * ==========================================
 */

// Schéma de création d'une caisse
export const createRegisterSchema = z.object({
  establishmentId: z.number().int().positive('L\'ID de l\'établissement est requis'),
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long'),
  isActive: z.boolean().default(true),
})

// Schéma de mise à jour d'une caisse
export const updateRegisterSchema = z.object({
  establishmentId: z.number().int().positive('L\'ID de l\'établissement est requis').optional(),
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long').optional(),
  isActive: z.boolean().optional(),
})

// Types TypeScript
export type CreateRegisterInput = z.infer<typeof createRegisterSchema>
export type UpdateRegisterInput = z.infer<typeof updateRegisterSchema>
