import type { Commune } from '@/types/geo'

const POSTAL_CODE_REGEX = /^\d{5}$/

/**
 * Récupère les communes correspondant à un code postal français (5 chiffres).
 * Valide le format avant l'appel pour éviter l'injection de paramètre dans l'URL.
 *
 * @throws {Error} si le code postal est invalide ou si l'API est indisponible
 */
export async function fetchCommunesByPostalCode(postalCode: string): Promise<Commune[]> {
  if (!POSTAL_CODE_REGEX.test(postalCode)) {
    throw new Error('Code postal invalide (5 chiffres attendus)')
  }

  const url = new URL('https://geo.api.gouv.fr/communes')
  url.searchParams.set('codePostal', postalCode)
  url.searchParams.set('fields', 'nom,code,codesPostaux,centre')
  url.searchParams.set('format', 'json')
  url.searchParams.set('geometry', 'centre')

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Erreur API geo.gouv.fr : ${response.status}`)
  }

  const data: Commune[] = await response.json()
  return data
}
