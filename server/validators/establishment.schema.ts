import { z } from 'zod'

/**
 * ==========================================
 * SCHÉMAS DE VALIDATION - ÉTABLISSEMENTS
 * ==========================================
 */

// Schéma de création d'un établissement
export const createEstablishmentSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),

  // Adresse
  address: z.string().max(500, 'L\'adresse est trop longue').optional().nullable(),
  postalCode: z.string().max(10, 'Le code postal est invalide').optional().nullable(),
  city: z.string().max(100, 'Le nom de la ville est trop long').optional().nullable(),
  country: z.string().max(100, 'Le nom du pays est trop long').default('France'),

  // Contact
  phone: z.string().max(20, 'Le numéro de téléphone est trop long').optional().nullable(),
  email: z.string().email('Email invalide').max(255, 'L\'email est trop long').optional().nullable(),

  // Informations légales
  siret: z.string()
    .length(14, 'Le SIRET doit contenir 14 chiffres')
    .regex(/^\d{14}$/, 'Le SIRET doit contenir uniquement des chiffres')
    .optional()
    .nullable(),
  naf: z.string()
    .length(5, 'Le code NAF doit contenir 5 caractères')
    .regex(/^\d{4}[A-Z]$/, 'Le code NAF doit être au format 1234A')
    .optional()
    .nullable(),
  tvaNumber: z.string()
    .max(20, 'Le numéro de TVA est trop long')
    .regex(/^[A-Z]{2}\d{11}$/, 'Le numéro de TVA doit être au format FR12345678901')
    .optional()
    .nullable(),

  isActive: z.boolean().default(true),
})

// Schéma de mise à jour d'un établissement
export const updateEstablishmentSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long').optional(),

  // Adresse
  address: z.string().max(500, 'L\'adresse est trop longue').optional().nullable(),
  postalCode: z.string().max(10, 'Le code postal est invalide').optional().nullable(),
  city: z.string().max(100, 'Le nom de la ville est trop long').optional().nullable(),
  country: z.string().max(100, 'Le nom du pays est trop long').optional().nullable(),

  // Contact
  phone: z.string().max(20, 'Le numéro de téléphone est trop long').optional().nullable(),
  email: z.string().email('Email invalide').max(255, 'L\'email est trop long').optional().nullable(),

  // Informations légales
  siret: z.string()
    .length(14, 'Le SIRET doit contenir 14 chiffres')
    .regex(/^\d{14}$/, 'Le SIRET doit contenir uniquement des chiffres')
    .optional()
    .nullable(),
  naf: z.string()
    .length(5, 'Le code NAF doit contenir 5 caractères')
    .regex(/^\d{4}[A-Z]$/, 'Le code NAF doit être au format 1234A')
    .optional()
    .nullable(),
  tvaNumber: z.string()
    .max(20, 'Le numéro de TVA est trop long')
    .regex(/^[A-Z]{2}\d{11}$/, 'Le numéro de TVA doit être au format FR12345678901')
    .optional()
    .nullable(),

  isActive: z.boolean().optional(),
})

// Types TypeScript
export type CreateEstablishmentInput = z.infer<typeof createEstablishmentSchema>
export type UpdateEstablishmentInput = z.infer<typeof updateEstablishmentSchema>
