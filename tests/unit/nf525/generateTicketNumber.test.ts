import { describe, it, expect } from 'vitest'
import { generateTicketNumber } from '~/server/utils/nf525'

describe('generateTicketNumber', () => {
  // T1 — Format de base
  it('T1 — retourne un string au format YYYYMMDD-E##-R##-######', () => {
    const result = generateTicketNumber(1, 1, 1)
    expect(result).toMatch(/^\d{8}-E\d{2}-R\d{2}-\d{6}$/)
  })

  // T2 — Padding établissement
  it('T2 — établissement 1 → E01', () => {
    const result = generateTicketNumber(1, 1, 1)
    expect(result).toContain('E01')
  })

  it('T2 — établissement 12 → E12', () => {
    const result = generateTicketNumber(1, 12, 1)
    expect(result).toContain('E12')
  })

  // T3 — Padding caisse
  it('T3 — caisse 1 → R01', () => {
    const result = generateTicketNumber(1, 1, 1)
    expect(result).toContain('R01')
  })

  it('T3 — caisse 10 → R10', () => {
    const result = generateTicketNumber(1, 1, 10)
    expect(result).toContain('R10')
  })

  // T4 — Padding séquence
  it('T4 — séquence 1 → 000001', () => {
    const result = generateTicketNumber(1, 1, 1)
    expect(result).toContain('000001')
  })

  it('T4 — séquence 999 → 000999', () => {
    const result = generateTicketNumber(999, 1, 1)
    expect(result).toContain('000999')
  })

  it('T4 — séquence 1000 → 001000', () => {
    const result = generateTicketNumber(1000, 1, 1)
    expect(result).toContain('001000')
  })

  // T5 — Date du jour
  it('T5 — commence par la date du jour au format YYYYMMDD (heure locale)', () => {
    const now = new Date()
    const today =
      `${now.getFullYear()}` +
      `${String(now.getMonth() + 1).padStart(2, '0')}` +
      `${String(now.getDate()).padStart(2, '0')}`
    const result = generateTicketNumber(1, 1, 1)
    expect(result.startsWith(today)).toBe(true)
  })
})
