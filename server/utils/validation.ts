import { type H3Event } from 'h3'
import { type ZodSchema, ZodError } from 'zod'

/**
 * ==========================================
 * Utilitaires de validation avec Zod
 * ==========================================
 */

/**
 * Valide le body d'une requête avec un schéma Zod
 * @param event - L'événement H3
 * @param schema - Le schéma Zod à utiliser pour la validation
 * @returns Les données validées
 * @throws Une erreur 400 si la validation échoue
 */
export async function validateBody<T>(event: H3Event, schema: ZodSchema<T>): Promise<T> {
  try {
    const body = await readBody(event)
    return schema.parse(body)
  }
  catch (error) {
    if (error instanceof ZodError) {
      const issues = (error.issues || (error as any).errors || []) as any[]
      const errors = issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      console.error('[Validation] Erreurs:', errors)

      throw createError({
        statusCode: 400,
        statusMessage: errors[0]?.message || 'Erreur de validation',
        message: 'Erreur de validation',
        data: { errors },
      })
    }
    throw error
  }
}

/**
 * Valide les query params avec un schéma Zod
 * @param event - L'événement H3
 * @param schema - Le schéma Zod à utiliser pour la validation
 * @returns Les données validées
 * @throws Une erreur 400 si la validation échoue
 */
export function validateQuery<T>(event: H3Event, schema: ZodSchema<T>): T {
  try {
    const query = getQuery(event)
    return schema.parse(query)
  }
  catch (error) {
    if (error instanceof ZodError) {
      const issues = (error.issues || (error as any).errors || []) as any[]
      const errors = issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      console.error('[Validation] Erreurs query:', errors)

      throw createError({
        statusCode: 400,
        statusMessage: errors[0]?.message || 'Erreur de validation des paramètres',
        message: 'Erreur de validation des paramètres',
        data: { errors },
      })
    }
    throw error
  }
}
