import { type H3Event } from 'h3'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * Utilitaires de validation avec Zod
 * ==========================================
 */

interface ValidationError {
  field: string
  message: string
}

/**
 * Valide le body d'une requête avec un schéma Zod
 * @param event - L'événement H3
 * @param schema - Le schéma Zod à utiliser pour la validation
 * @returns Les données validées
 * @throws Une erreur 400 si la validation échoue
 */
export async function validateBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  try {
    const body = await readBody(event)
    return schema.parse(body)
  }
  catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      const firstMessage = errors[0]?.message || 'Erreur de validation'

      logger.error({ errors }, 'Erreurs de validation du body')

      throw createError({
        statusCode: 400,
        statusMessage: firstMessage,
        message: firstMessage,
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
export function validateQuery<T>(event: H3Event, schema: ZodType<T>): T {
  try {
    const query = getQuery(event)
    return schema.parse(query)
  }
  catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))

      logger.error({ errors }, 'Erreurs de validation des query params')

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
