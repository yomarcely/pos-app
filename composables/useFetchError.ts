/**
 * Extraction d'erreurs $fetch (FetchError Nitro/H3).
 *
 * - `extractFetchError` : message lisible (string) — API historique, inchangée.
 *   Priorité : data.message → data.statusMessage → statusMessage → message → fallback
 * - `extractApiError` : version structurée qui expose aussi `code` et `retryable`
 *   quand le serveur a répondu via `createApiError` (server/utils/apiResponse.ts).
 *   Rétro-compatible : sur une erreur sans code/retryable, ces champs sont undefined.
 *
 * Usage :
 *   import { extractFetchError, extractApiError } from '@/composables/useFetchError'
 *   const message = extractFetchError(err, 'Erreur lors de la sauvegarde')
 *   const { message, code, retryable } = extractApiError(err)
 */

export interface ExtractedApiError {
  message: string
  /** Slug machine SCREAMING_SNAKE_CASE (ex. CART_EMPTY) — undefined si absent. */
  code?: string
  /** La requête peut-elle être rejouée telle quelle ? — undefined si absent. */
  retryable?: boolean
  statusCode?: number
}

interface FetchErrorLike {
  // FetchError : `data` = corps JSON H3 { statusCode, statusMessage, message, data: {...} }
  // H3Error brut : `data` = le payload directement { code, retryable, ... }
  data?: {
    message?: string
    statusMessage?: string
    code?: unknown
    retryable?: unknown
    data?: { code?: unknown; retryable?: unknown }
  }
  statusMessage?: string
  message?: string
  statusCode?: number
}

export function extractApiError(err: unknown, fallback = 'Une erreur est survenue'): ExtractedApiError {
  if (typeof err !== 'object' || err === null) return { message: fallback }
  const e = err as FetchErrorLike

  const payload = e.data?.data ?? e.data
  const code = typeof payload?.code === 'string' ? payload.code : undefined
  const retryable = typeof payload?.retryable === 'boolean' ? payload.retryable : undefined

  return {
    message: e.data?.message ?? e.data?.statusMessage ?? e.statusMessage ?? e.message ?? fallback,
    code,
    retryable,
    statusCode: typeof e.statusCode === 'number' ? e.statusCode : undefined,
  }
}

export function extractFetchError(err: unknown, fallback = 'Une erreur est survenue'): string {
  return extractApiError(err, fallback).message
}
