/**
 * Extrait un message lisible depuis une erreur $fetch (FetchError Nitro/H3).
 * Priorité : data.message → data.statusMessage → statusMessage → message → fallback
 *
 * Usage :
 *   import { extractFetchError } from '@/composables/useFetchError'
 *   const message = extractFetchError(err, 'Erreur lors de la sauvegarde')
 */
export function extractFetchError(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (typeof err !== 'object' || err === null) return fallback
  const e = err as Record<string, any>
  return e?.data?.message ?? e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? fallback
}
