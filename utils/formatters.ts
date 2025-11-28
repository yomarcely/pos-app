/**
 * Formatte un prix en euros avec le format français
 * @param price - Prix à formater (number ou string)
 * @param fallback - Valeur utilisée si le prix est invalide (défaut 0)
 * @returns Prix formatté (ex: "12,34 €")
 */
export function formatPrice(price: string | number, fallback: number = 0): string {
  const parsed =
    typeof price === 'string'
      ? Number(price.replace(',', '.'))
      : price
  const safeValue = Number.isFinite(parsed) ? parsed : fallback
  const rounded = Math.round(safeValue * 100) / 100

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(rounded)
}

/**
 * Formatte une date au format français (JJ/MM/AAAA)
 * @param value - Date (string ISO ou Date)
 * @returns Date formatée (ex: "25/12/2024")
 */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date?.getTime?.())) return ''

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * Formatte une date et heure au format français
 * @param value - Date (string ISO ou Date)
 * @returns Date et heure formatées (ex: "25/12/2024, 14:30")
 */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date?.getTime?.())) return ''

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * Formatte un nombre avec séparateurs de milliers
 * @param value - Nombre à formater
 * @returns Nombre formatté (ex: "1 234")
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

/**
 * Formatte un pourcentage
 * @param value - Valeur décimale (ex: 0.2 pour 20%)
 * @param decimals - Nombre de décimales (défaut: 0)
 * @returns Pourcentage formatté (ex: "20 %")
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
