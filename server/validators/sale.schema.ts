import { z } from 'zod'

/**
 * ==========================================
 * Schémas de validation Zod pour les ventes
 * ==========================================
 */

const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1),
  variation: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  unitPrice: z.string().or(z.number()).transform(val => String(val)),
  discount: z.string().or(z.number()).transform(val => String(val)).default('0'),
  discountType: z.enum(['%', '€']).default('%'),
  tva: z.string().or(z.number()).transform(val => String(val)),
  totalHT: z.string().or(z.number()).optional().default('0').transform(val => String(val ?? '0')),
  totalTTC: z.string().or(z.number()).optional().default('0').transform(val => String(val ?? '0')),
})

const paymentSchema = z.object({
  mode: z.string().min(1),
  amount: z.number().positive(),
})

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Au moins un article est requis'),
  payments: z.array(paymentSchema).min(1, 'Au moins un paiement est requis'),
  totalHT: z.string().or(z.number()).transform(val => String(val)),
  totalTVA: z.string().or(z.number()).transform(val => String(val)),
  totalTTC: z.string().or(z.number()).transform(val => String(val)),
  globalDiscount: z.string().or(z.number()).transform(val => String(val)).default('0'),
  globalDiscountType: z.enum(['%', '€']).default('%'),
  customerId: z.number().int().positive().optional().nullable(),
  sellerId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export const cancelSaleSchema = z.object({
  reason: z.string().min(1, 'La raison d\'annulation est requise').max(500),
  userId: z.number().int().positive().optional(),
})

export const closeDaySchema = z.object({
  date: z.string().min(8, 'Date de clôture manquante'), // format YYYY-MM-DD attendu
  userId: z.number().int().positive().optional().nullable(),
  userName: z.string().optional().nullable(),
})

// Variante alignée sur le payload existant (totals + globalDiscount)
export const createSaleRequestSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Au moins un article est requis'),
  seller: z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
  }),
  customer: z.object({
    id: z.number().int().positive(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
  }).optional().nullable(),
  payments: z.array(paymentSchema).min(1, 'Au moins un paiement est requis'),
  totals: z.object({
    totalHT: z.number(),
    totalTVA: z.number(),
    totalTTC: z.number(),
  }),
  globalDiscount: z.object({
    value: z.number().optional().default(0),
    type: z.enum(['%', '€']).default('%'),
  }),
  establishmentId: z.number().int().positive('Établissement requis'),
  registerId: z.number().int().positive('Caisse requise'),
})

export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>
export type CreateSaleRequestInput = z.infer<typeof createSaleRequestSchema>
export type CloseDayInput = z.infer<typeof closeDaySchema>
