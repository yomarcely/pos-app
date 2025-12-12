import { z } from 'zod'

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Le prénom est requis'),
  lastname: z.string().min(1, 'Le nom est requis'),
  postalcode: z.string().min(2, 'Code postal requis'),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phonenumber: z.string().optional().nullable(),
  mail: z.string().email('Email invalide').optional().nullable(),
  fidelity: z.boolean().optional(),
  authorizesms: z.boolean().optional(),
  authorizemailing: z.boolean().optional(),
  discount: z.number().or(z.string()).optional(),
  alert: z.string().optional().nullable(),
  information: z.string().optional().nullable(),
})

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

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type CreateClientInput = z.infer<typeof createClientSchema>
