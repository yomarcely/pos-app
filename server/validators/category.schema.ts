import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Le nom de la catégorie est requis').max(255),
  parentId: z.number().int().positive().optional().nullable(),
})

export const updateCategorySchema = createCategorySchema.partial()

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
