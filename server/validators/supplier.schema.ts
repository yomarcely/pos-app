import { z } from 'zod'

/**
 * ==========================================
 * Schémas de validation Zod pour les fournisseurs
 * ==========================================
 */

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Le nom du fournisseur est requis').max(255),
  contact: z.string().max(255).optional().nullable(),
  email: z.string().email('Email invalide').max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isArchived: z.boolean().default(false),
})

export const updateSupplierSchema = createSupplierSchema.partial()

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
