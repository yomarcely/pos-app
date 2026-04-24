import { z } from 'zod'

/**
 * ==========================================
 * SCHÉMAS DE VALIDATION - TICKETS EN ATTENTE
 * ==========================================
 *
 * Paniers mis en attente par le caissier avant encaissement.
 * Pas soumis à NF525 (pas encore une vente).
 */

// Item dans le panier — validation minimale, on fait confiance au client pour la structure
// complète car c'est un snapshot du panier actif (déjà validé côté client).
const pendingItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  discount: z.number(),
  discountType: z.enum(['%', '€']),
  variation: z.string(),
  tva: z.number().optional(),
  image: z.string().nullable().optional(),
  restockOnReturn: z.boolean().optional(),
  _uniqueId: z.number().optional(),
}).passthrough() // tolère les champs supplémentaires (Product a beaucoup de champs)

export const createPendingSaleSchema = z.object({
  establishmentId: z.number().int().positive(),
  registerId: z.number().int().positive(),
  customerId: z.number().int().positive().nullable().optional(),
  items: z.array(pendingItemSchema).min(1, 'Le panier ne peut pas être vide'),
  globalDiscount: z.number().min(0).default(0),
  globalDiscountType: z.enum(['%', '€']).default('%'),
})

export type CreatePendingSaleInput = z.infer<typeof createPendingSaleSchema>
