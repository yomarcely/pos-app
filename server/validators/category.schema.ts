import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Le nom de la catégorie est requis').max(255),
  parentId: z.number().int().positive().optional().nullable(),
  // Optionnel: permet de passer l'établissement directement dans le body si non fourni en query
  establishmentId: z.coerce.number().int().positive().optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
