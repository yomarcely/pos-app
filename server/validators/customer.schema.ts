import { z } from 'zod'

export const createClientSchema = z.object({
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().email('Email invalide').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
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
