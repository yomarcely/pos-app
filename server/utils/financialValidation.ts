import { logger } from '~/server/utils/logger'

/**
 * Recalcule le totalTTC attendu à partir des lignes de vente.
 * Utilise des centimes entiers pour éviter l'accumulation de floats.
 * Le `unitPrice` doit être le prix final après remise de ligne.
 * Retourne le totalTTC en euros (2 décimales).
 */
export function recomputeTotalTTC(items: Array<{
  unitPrice: number
  quantity: number
  lineDiscount?: number
}>): number {
  const cents = items.reduce((sum, item) => {
    const priceAfterDiscount = item.unitPrice * (1 - (item.lineDiscount ?? 0) / 100)
    return sum + Math.round(priceAfterDiscount * item.quantity * 100)
  }, 0)
  return cents / 100
}

/**
 * Vérifie que le totalTTC déclaré est cohérent avec les lignes.
 * Tolère un écart de 2 centimes par défaut (remise globale LRM).
 */
export function validateTotalTTC(
  declared: number,
  recomputed: number,
  toleranceCents = 2
): boolean {
  return Math.abs(Math.round(declared * 100) - Math.round(recomputed * 100)) <= toleranceCents
}

/**
 * Vérifie que HT + TVA = TTC à 1 centime près.
 * Logue un warning (pas un throw) — la clôture continue,
 * l'anomalie est tracée pour investigation.
 */
export function assertHTplusTVAequalsTTC(
  totalHT: number,
  totalTVA: number,
  totalTTC: number,
  context: string
): void {
  const sumCents = Math.round(totalHT * 100) + Math.round(totalTVA * 100)
  const ttcCents = Math.round(totalTTC * 100)
  if (Math.abs(sumCents - ttcCents) > 1) {
    logger.warn({
      context,
      totalHT,
      totalTVA,
      totalTTC,
      diff: (sumCents - ttcCents) / 100,
    }, 'Incohérence HT+TVA≠TTC dans la clôture')
  }
}
