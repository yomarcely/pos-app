import { z } from 'zod'

export const NOTE_TYPES = ['general', 'client', 'tache'] as const

export const createNoteSchema = z.object({
  content: z.string().trim().min(1, 'La note ne peut pas être vide'),
  type: z.enum(NOTE_TYPES).default('general'),
  customerId: z.coerce.number().int().positive().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable().or(z.literal('')),
  establishmentId: z.coerce.number().int().positive().optional().nullable(),
})

export const updateNoteSchema = z.object({
  content: z.string().trim().min(1, 'La note ne peut pas être vide').optional(),
  type: z.enum(NOTE_TYPES).optional(),
  customerId: z.coerce.number().int().positive().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable().or(z.literal('')),
  done: z.boolean().optional(),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
