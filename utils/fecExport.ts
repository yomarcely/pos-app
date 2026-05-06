/**
 * Génération du Fichier des Écritures Comptables (FEC) — format DGFiP.
 *
 * Spécification : Article A47 A-1 du Livre des procédures fiscales (LPF).
 * 18 colonnes obligatoires, séparateur `|`, encoding UTF-8.
 *
 * Convention : 1 écriture comptable par vente. Chaque écriture contient :
 * - N lignes 707xxx (CREDIT) — ventes HT, groupées par taux TVA
 * - N lignes 4457xx (CREDIT) — TVA collectée par taux
 * - M lignes 530000 / 512000 / 467000 (DEBIT) — paiements par mode
 *
 * Garantie comptable : pour chaque écriture, total DEBIT = total CREDIT.
 */

export interface FecSaleItem {
  totalHT: number
  totalTTC: number
  tvaRate: number // % (ex: 20)
}

export interface FecPayment {
  mode: string
  amount: number
}

export interface FecSale {
  ticketNumber: string
  saleDate: Date | string
  totalHT: number
  totalTVA: number
  totalTTC: number
  items: FecSaleItem[]
  payments: FecPayment[]
}

export interface FecExportOptions {
  /** Date de validation comptable (ValidDate). Défaut : maintenant. */
  validationDate?: Date
}

const FEC_HEADERS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
]

const JOURNAL_CODE = 'VT'
const JOURNAL_LIB = 'Ventes caisse'

// Mapping mode de paiement → compte PCG. Inconnu → 471000 Compte d'attente.
function paymentAccount(mode: string): { num: string, lib: string } {
  const lower = mode.toLowerCase()
  if (lower.includes('espèce') || lower.includes('especes') || lower.includes('cash')) {
    return { num: '530000', lib: 'Caisse' }
  }
  if (lower.includes('carte') || lower.includes('cb')) {
    return { num: '512000', lib: 'Banque - Carte bancaire' }
  }
  if (lower.includes('bon')) {
    return { num: '467000', lib: 'Bons d\'achat' }
  }
  if (lower.includes('chèque') || lower.includes('cheque')) {
    return { num: '511000', lib: 'Chèques à l\'encaissement' }
  }
  return { num: '471000', lib: 'Compte d\'attente' }
}

// Compte TVA par taux. Standard PCG : 445710 (20%), 445712 (10%), 445714 (5.5%), 445716 (2.1%).
function tvaAccount(rate: number): { num: string, lib: string } {
  if (Math.abs(rate - 20) < 0.01) return { num: '445710', lib: 'TVA collectée 20%' }
  if (Math.abs(rate - 10) < 0.01) return { num: '445712', lib: 'TVA collectée 10%' }
  if (Math.abs(rate - 5.5) < 0.01) return { num: '445714', lib: 'TVA collectée 5,5%' }
  if (Math.abs(rate - 2.1) < 0.01) return { num: '445716', lib: 'TVA collectée 2,1%' }
  // Taux non standard : compte générique avec libellé personnalisé
  return { num: '445718', lib: `TVA collectée ${rate.toFixed(2)}%` }
}

function salesAccount(rate: number): { num: string, lib: string } {
  if (Math.abs(rate - 20) < 0.01) return { num: '707100', lib: 'Ventes - TVA 20%' }
  if (Math.abs(rate - 10) < 0.01) return { num: '707200', lib: 'Ventes - TVA 10%' }
  if (Math.abs(rate - 5.5) < 0.01) return { num: '707300', lib: 'Ventes - TVA 5,5%' }
  if (Math.abs(rate - 2.1) < 0.01) return { num: '707400', lib: 'Ventes - TVA 2,1%' }
  return { num: '707000', lib: `Ventes - TVA ${rate.toFixed(2)}%` }
}

/** Format YYYYMMDD requis par le FEC. */
function fecDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Format montant DGFiP : virgule décimale, 2 chiffres après. Ex: "1234,56". 0 → "0,00" (vide non admis). */
function fecAmount(amount: number): string {
  if (amount === 0) return '0,00'
  return amount.toFixed(2).replace('.', ',')
}

/** Échappement : un champ ne doit pas contenir le séparateur `|`. On remplace par espace. */
function escape(value: string): string {
  return String(value ?? '').replace(/[\r\n|\t]/g, ' ').trim()
}

/**
 * Construit le contenu FEC complet (en-tête + N lignes par vente).
 * Retourne une string prête à être servie en tant que fichier (ex: text/plain).
 */
export function buildFecContent(sales: FecSale[], options: FecExportOptions = {}): string {
  const validDate = options.validationDate ?? new Date()
  const validDateStr = fecDate(validDate)

  const rows: string[] = []
  rows.push(FEC_HEADERS.join('|'))

  for (const sale of sales) {
    const ecritureNum = sale.ticketNumber
    const ecritureDate = fecDate(sale.saleDate)
    const lib = `Vente ticket ${sale.ticketNumber}`

    // 1. Lignes DEBIT (paiements) — les vouchers et autres modes alimentent leur compte respectif
    for (const pay of sale.payments) {
      if (pay.amount === 0) continue
      const acc = paymentAccount(pay.mode)
      // Si paiement négatif (remboursement), inverser débit/crédit
      const debit = pay.amount > 0 ? pay.amount : 0
      const credit = pay.amount < 0 ? -pay.amount : 0
      rows.push([
        JOURNAL_CODE,
        JOURNAL_LIB,
        escape(ecritureNum),
        ecritureDate,
        acc.num,
        acc.lib,
        '',
        '',
        escape(sale.ticketNumber),
        ecritureDate,
        `${escape(lib)} - ${escape(pay.mode)}`,
        fecAmount(debit),
        fecAmount(credit),
        '',
        '',
        validDateStr,
        '',
        '',
      ].join('|'))
    }

    // 2. Agrégation HT et TVA par taux (depuis items)
    const buckets = new Map<number, { ht: number, tva: number }>()
    for (const item of sale.items) {
      const ht = item.totalHT
      const tva = item.totalTTC - item.totalHT
      const bucket = buckets.get(item.tvaRate) ?? { ht: 0, tva: 0 }
      bucket.ht += ht
      bucket.tva += tva
      buckets.set(item.tvaRate, bucket)
    }

    // Pour les ventes sans items (cas exotique), on retombe sur le total global avec taux 0
    if (buckets.size === 0 && sale.totalTTC !== 0) {
      buckets.set(0, { ht: sale.totalHT, tva: sale.totalTVA })
    }

    // 3. Lignes CREDIT — ventes HT par taux + TVA collectée par taux
    const sortedRates = Array.from(buckets.keys()).sort((a, b) => a - b)
    for (const rate of sortedRates) {
      const { ht, tva } = buckets.get(rate)!
      const sales707 = salesAccount(rate)
      const tva4457 = tvaAccount(rate)

      // Vente HT (CREDIT)
      if (ht !== 0) {
        const debit = ht < 0 ? -ht : 0
        const credit = ht > 0 ? ht : 0
        rows.push([
          JOURNAL_CODE,
          JOURNAL_LIB,
          escape(ecritureNum),
          ecritureDate,
          sales707.num,
          sales707.lib,
          '',
          '',
          escape(sale.ticketNumber),
          ecritureDate,
          escape(lib),
          fecAmount(debit),
          fecAmount(credit),
          '',
          '',
          validDateStr,
          '',
          '',
        ].join('|'))
      }

      // TVA collectée (CREDIT)
      if (tva !== 0) {
        const debit = tva < 0 ? -tva : 0
        const credit = tva > 0 ? tva : 0
        rows.push([
          JOURNAL_CODE,
          JOURNAL_LIB,
          escape(ecritureNum),
          ecritureDate,
          tva4457.num,
          tva4457.lib,
          '',
          '',
          escape(sale.ticketNumber),
          ecritureDate,
          escape(lib),
          fecAmount(debit),
          fecAmount(credit),
          '',
          '',
          validDateStr,
          '',
          '',
        ].join('|'))
      }
    }
  }

  return rows.join('\n') + '\n'
}

/** Nom de fichier conforme — convention DGFiP : SIREN + FEC + date d'arrêté. */
export function buildFecFilename(siren: string | null | undefined, periodEnd: Date): string {
  const safeSiren = (siren ?? 'NOSIREN').replace(/[^0-9]/g, '').slice(0, 9) || 'NOSIREN'
  const dateStr = fecDate(periodEnd)
  return `${safeSiren}FEC${dateStr}.txt`
}
