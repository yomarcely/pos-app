/**
 * Helpers purs pour /api/stats/revenue.
 * Extraits pour testabilité (la marge est un calcul financier — règle CLAUDE.md).
 */

export interface MarginKpis {
  totalCost: number
  totalMargin: number
  marginPct: number | null
  marginCoveragePct: number | null
}

/**
 * Calcule la marge sur la période et la couverture du snapshot purchasePrice.
 *
 * - totalMargin = revenu HT couvert par snapshot − coût total snapshoté.
 * - marginPct = ratio marge sur le revenu HT *couvert* (et non total),
 *   sinon les ventes pré-migration (sans snapshot) dilueraient artificiellement le %.
 * - marginCoveragePct = part du CA HT total couverte par un snapshot purchasePrice
 *   (indicateur de fiabilité du chiffre de marge affiché).
 *
 * @param totalCostCovered  Σ(quantity * purchasePriceAtSale) sur items snapshotés
 * @param totalHTCovered    Σ(totalHT) sur items snapshotés
 * @param totalHTAll        Σ(totalHT) sur tous les items de la période
 */
export function computeMarginKpis(
  totalCostCovered: number,
  totalHTCovered: number,
  totalHTAll: number
): MarginKpis {
  const totalMargin = totalHTCovered - totalCostCovered
  const marginPct = totalHTCovered > 0 ? (totalMargin / totalHTCovered) * 100 : null
  const marginCoveragePct = totalHTAll > 0 ? (totalHTCovered / totalHTAll) * 100 : null

  return {
    totalCost: round2(totalCostCovered),
    totalMargin: round2(totalMargin),
    marginPct: marginPct === null ? null : round2(marginPct),
    marginCoveragePct: marginCoveragePct === null ? null : round2(marginCoveragePct),
  }
}

/**
 * Complète une série horaire (postgres ne renvoie que les heures avec des ventes)
 * pour avoir un tableau de 24 entrées, heures vides à 0.
 */
export function densifyHourlySeries(
  rows: Array<{ hour: number; ttc: number; ticketCount: number }>
): Array<{ hour: number; ttc: number; ticketCount: number }> {
  const byHour = new Map<number, { ttc: number; ticketCount: number }>()
  for (const row of rows) {
    byHour.set(row.hour, { ttc: row.ttc, ticketCount: row.ticketCount })
  }
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    ttc: byHour.get(h)?.ttc ?? 0,
    ticketCount: byHour.get(h)?.ticketCount ?? 0,
  }))
}

/**
 * Parse un paramètre d'ID(s) accepté en single ("1") ou CSV ("1,2,3").
 * Renvoie null si vide/invalide (pas de filtre).
 */
export function parseIdsParam(raw: string | string[] | undefined): number[] | null {
  if (!raw) return null
  const str = Array.isArray(raw) ? raw.join(',') : raw
  const ids = str
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0)
  return ids.length > 0 ? ids : null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
