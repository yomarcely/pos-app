import { z } from 'zod'

export const createClientSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est obligatoire'),
  lastName: z.string().min(1, 'Le nom est obligatoire'),
  email: z.string().email('Email invalide').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().length(5, 'Le code postal doit contenir 5 chiffres'),
  gdprConsent: z.boolean(),
  marketingConsent: z.boolean().optional(),
  loyaltyProgram: z.boolean().optional(),
  discount: z.number().or(z.string()).optional(),
  notes: z.string().optional().nullable(),
  alerts: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
  establishmentId: z.coerce.number().optional(),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
