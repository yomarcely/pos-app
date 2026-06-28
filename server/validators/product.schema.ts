import { z } from 'zod'

/**
 * ==========================================
 * Schémas de validation Zod pour les produits
 * ==========================================
 */

// Schéma pour la création d'un produit
export const createProductSchema = z.object({
  name: z.string().min(1, 'Le nom du produit est requis').max(255),
  supplierCode: z.string().max(100).optional().nullable(),
  barcode: z.string().max(255).optional().nullable(),
  barcodeByVariation: z.record(z.string(), z.string()).optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  supplierId: z.number().int().positive().optional().nullable(),
  brandId: z.number().int().positive().optional().nullable(),
  price: z.string().or(z.number()).transform(val => String(val)),
  purchasePrice: z.string().or(z.number()).transform(val => String(val)).optional().nullable(),
  tva: z.string().or(z.number()).transform(val => String(val)).default('20'),
  tvaId: z.number().int().positive().optional().nullable(),
  manageStock: z.boolean().optional(),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(5),
  stockByVariation: z.record(z.string(), z.number().int().min(0)).optional().nullable(),
  minStockByVariation: z.record(z.string(), z.number().int().min(0)).optional().nullable(),
  variationGroupIds: z.array(z.number().int().positive()).optional().nullable(),
  hasVariations: z.boolean().optional(),
  image: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isArchived: z.boolean().default(false),
})

// Schéma pour la mise à jour d'un produit
export const updateProductSchema = createProductSchema.partial()

// Type TypeScript inféré du schéma
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
