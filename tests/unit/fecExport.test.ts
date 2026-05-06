import { describe, it, expect } from 'vitest'
import { buildFecContent, buildFecFilename, type FecSale } from '@/utils/fecExport'

function makeSale(overrides: Partial<FecSale> = {}): FecSale {
  return {
    ticketNumber: '20260426-E01-R01-000001',
    saleDate: new Date('2026-04-26T10:30:00Z'),
    totalHT: 100,
    totalTVA: 20,
    totalTTC: 120,
    items: [
      { totalHT: 100, totalTTC: 120, tvaRate: 20 },
    ],
    payments: [
      { mode: 'Carte', amount: 120 },
    ],
    ...overrides,
  }
}

function parseLines(content: string): string[] {
  return content.split('\n').filter(l => l.length > 0)
}

function parseRow(line: string): string[] {
  return line.split('|')
}

describe('buildFecContent — format général', () => {
  it('première ligne = en-têtes des 18 colonnes DGFiP', () => {
    const content = buildFecContent([])
    const headers = parseRow(parseLines(content)[0]!)
    expect(headers).toEqual([
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
    ])
  })

  it('aucune ligne de mouvement si pas de ventes', () => {
    expect(parseLines(buildFecContent([])).length).toBe(1) // header only
  })

  it('chaque ligne de mouvement contient exactement 18 colonnes', () => {
    const content = buildFecContent([makeSale()])
    const lines = parseLines(content)
    for (const line of lines.slice(1)) {
      expect(parseRow(line).length).toBe(18)
    }
  })
})

describe('buildFecContent — écritures par vente', () => {
  it('vente 100 HT + 20 TVA + 120 paiement carte → 3 lignes équilibrées', () => {
    const content = buildFecContent([makeSale()])
    const lines = parseLines(content).slice(1) // skip header
    expect(lines).toHaveLength(3)

    let totalDebit = 0
    let totalCredit = 0
    for (const line of lines) {
      const cols = parseRow(line)
      totalDebit += parseFloat(cols[11]!.replace(',', '.'))
      totalCredit += parseFloat(cols[12]!.replace(',', '.'))
    }
    expect(totalDebit).toBeCloseTo(120, 2)
    expect(totalCredit).toBeCloseTo(120, 2)
  })

  it('mode Carte → compte 512000 (Banque)', () => {
    const content = buildFecContent([makeSale()])
    expect(content).toContain('|512000|Banque - Carte bancaire|')
  })

  it('mode Espèces → compte 530000 (Caisse)', () => {
    const content = buildFecContent([makeSale({
      payments: [{ mode: 'Espèces', amount: 120 }],
    })])
    expect(content).toContain('|530000|Caisse|')
  })

  it('mode "Bon d\'achat #ABCD1234" → compte 467000', () => {
    const content = buildFecContent([makeSale({
      payments: [{ mode: 'Bon d\'achat #ABCD1234', amount: 10 }, { mode: 'Carte', amount: 110 }],
    })])
    expect(content).toContain('|467000|Bons d\'achat|')
  })

  it('mode inconnu → compte 471000 (compte d\'attente)', () => {
    const content = buildFecContent([makeSale({
      payments: [{ mode: 'Crypto', amount: 120 }],
    })])
    expect(content).toContain('|471000|Compte d\'attente|')
  })

  it('TVA 20% → compte 445710 et ventes 707100', () => {
    const content = buildFecContent([makeSale()])
    expect(content).toContain('|445710|TVA collectée 20%|')
    expect(content).toContain('|707100|Ventes - TVA 20%|')
  })

  it('TVA 5,5% → compte 445714 et ventes 707300', () => {
    const content = buildFecContent([makeSale({
      items: [{ totalHT: 100, totalTTC: 105.5, tvaRate: 5.5 }],
      totalHT: 100, totalTVA: 5.5, totalTTC: 105.5,
      payments: [{ mode: 'Carte', amount: 105.5 }],
    })])
    expect(content).toContain('|445714|TVA collectée 5,5%|')
    expect(content).toContain('|707300|Ventes - TVA 5,5%|')
  })

  it('plusieurs taux TVA → 1 ligne 707 + 1 ligne 4457 par taux, triées par taux croissant', () => {
    const content = buildFecContent([makeSale({
      items: [
        { totalHT: 50, totalTTC: 60, tvaRate: 20 },
        { totalHT: 100, totalTTC: 105.5, tvaRate: 5.5 },
      ],
      totalHT: 150, totalTVA: 15.5, totalTTC: 165.5,
      payments: [{ mode: 'Carte', amount: 165.5 }],
    })])
    const lines = parseLines(content).slice(1)
    expect(lines).toHaveLength(5) // 1 carte + 2x(707+4457)

    // L'ordre dans le fichier : paiement(s) d'abord, puis ventes par taux croissant
    const credits = lines.slice(1) // skip carte
    expect(credits[0]).toContain('|707300|') // 5.5% en premier
    expect(credits[1]).toContain('|445714|')
    expect(credits[2]).toContain('|707100|') // 20% ensuite
    expect(credits[3]).toContain('|445710|')
  })

  it('plusieurs paiements → une ligne par mode', () => {
    const content = buildFecContent([makeSale({
      payments: [
        { mode: 'Espèces', amount: 50 },
        { mode: 'Carte', amount: 70 },
      ],
    })])
    const lines = parseLines(content).slice(1)
    const debitLines = lines.filter(l => parseFloat(parseRow(l)[11]!.replace(',', '.')) > 0)
    expect(debitLines).toHaveLength(2)
  })

  it('paiements zéro ignorés', () => {
    const content = buildFecContent([makeSale({
      payments: [{ mode: 'Carte', amount: 0 }, { mode: 'Espèces', amount: 120 }],
    })])
    const lines = parseLines(content).slice(1)
    // Pas de ligne 512000 (Carte à 0)
    expect(lines.find(l => l.includes('|512000|'))).toBeUndefined()
    // Mais la ligne 530000 existe
    expect(lines.find(l => l.includes('|530000|'))).toBeDefined()
  })
})

describe('buildFecContent — format des champs', () => {
  it('EcritureDate au format YYYYMMDD (sans tirets)', () => {
    const content = buildFecContent([makeSale({
      saleDate: new Date('2026-04-26T10:30:00Z'),
    })])
    const firstMovement = parseLines(content).slice(1)[0]!
    const date = parseRow(firstMovement)[3]!
    expect(date).toMatch(/^\d{8}$/)
  })

  it('Montants au format français (virgule décimale, 2 chiffres)', () => {
    const content = buildFecContent([makeSale()])
    const firstMovement = parseLines(content).slice(1)[0]!
    const cols = parseRow(firstMovement)
    expect(cols[11]).toMatch(/^\d+,\d{2}$/) // Debit
    expect(cols[12]).toMatch(/^\d+,\d{2}$/) // Credit
  })

  it('JournalCode = "VT" et JournalLib = "Ventes caisse"', () => {
    const content = buildFecContent([makeSale()])
    const firstMovement = parseLines(content).slice(1)[0]!
    const cols = parseRow(firstMovement)
    expect(cols[0]).toBe('VT')
    expect(cols[1]).toBe('Ventes caisse')
  })

  it('PieceRef = ticketNumber, PieceDate = saleDate', () => {
    const content = buildFecContent([makeSale({
      ticketNumber: '20260426-E01-R01-000042',
    })])
    const firstMovement = parseLines(content).slice(1)[0]!
    const cols = parseRow(firstMovement)
    expect(cols[8]).toBe('20260426-E01-R01-000042')
  })

  it('Le caractère pipe dans les libellés est remplacé', () => {
    const content = buildFecContent([makeSale({
      ticketNumber: 'TICK|WITH|PIPES',
    })])
    const lines = parseLines(content).slice(1)
    for (const line of lines) {
      expect(parseRow(line).length).toBe(18) // pas plus de pipes que prévu
    }
  })
})

describe('buildFecFilename', () => {
  it('SIREN extrait des 9 premiers chiffres du SIRET', () => {
    const name = buildFecFilename('12345678901234', new Date('2026-12-31'))
    expect(name).toBe('123456789FEC20261231.txt')
  })

  it('SIREN absent → "NOSIREN"', () => {
    const name = buildFecFilename(null, new Date('2026-12-31'))
    expect(name).toBe('NOSIRENFEC20261231.txt')
  })

  it('SIREN avec espaces et caractères → nettoyé', () => {
    const name = buildFecFilename('123 456 789 abc', new Date('2026-01-15'))
    expect(name).toBe('123456789FEC20260115.txt')
  })
})
