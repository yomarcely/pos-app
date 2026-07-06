import type { ZodType } from 'zod'
import { ZodError } from 'zod'
import { logger } from '~/server/utils/logger'
import { createApiError } from '~/server/utils/apiResponse'

// Type inline érasé par TS — pas d'import 'h3' (cf. server/utils/supabase.ts).
type H3Event = import('h3').H3Event

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

      throw createApiError(400, 'VALIDATION_ERROR', firstMessage, {
        statusMessage: firstMessage,
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

      throw createApiError(400, 'VALIDATION_ERROR', 'Erreur de validation des paramètres', {
        statusMessage: errors[0]?.message || 'Erreur de validation des paramètres',
        data: { errors },
      })
    }
    throw error
  }
}
