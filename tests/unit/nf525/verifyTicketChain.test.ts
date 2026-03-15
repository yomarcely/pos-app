import { describe, it, expect } from 'vitest'
import { generateTicketHash, verifyTicketChain } from '~/server/utils/nf525'
import type { TicketData } from '~/server/utils/nf525'

// ─── Helper ───────────────────────────────────────────────────────────────────

type ChainTicket = TicketData & {
  currentHash: string
  previousHash: string | null
}

function makeTicket(seq: number, previousHash: string | null): ChainTicket {
  const ticketData: TicketData = {
    ticketNumber: `20250120-E01-R01-${String(seq).padStart(6, '0')}`,
    saleDate: new Date('2025-01-20T10:00:00.000Z'),
    sellerId: 1,
    establishmentNumber: 1,
    registerNumber: 1,
    totalTTC: 10,
    totalHT: 8.33,
    totalTVA: 1.67,
    items: [
      {
        productId: seq,
        quantity: 1,
        unitPrice: 10,
        totalTTC: 10,
        tva: 20,
        tvaCode: 'TVA20',
      },
    ],
    payments: [{ mode: 'cash', amount: 10 }],
  }
  const currentHash = generateTicketHash(ticketData, previousHash)
  return { ...ticketData, currentHash, previousHash }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('verifyTicketChain', () => {
  // T1 — Chaîne vide
  it('T1 — retourne isValid: true et brokenLinks: [] pour une chaîne vide', () => {
    const result = verifyTicketChain([])
    expect(result).toEqual({ isValid: true, brokenLinks: [] })
  })

  // T2 — 1 ticket valide (premier ticket)
  it('T2 — retourne isValid: true pour un seul ticket valide (previousHash: null)', () => {
    const t1 = makeTicket(1, null)
    const result = verifyTicketChain([t1])
    expect(result).toEqual({ isValid: true, brokenLinks: [] })
  })

  // T3 — Chaîne de 3 tickets valides
  it('T3 — retourne isValid: true pour une chaîne de 3 tickets cohérents', () => {
    const t1 = makeTicket(1, null)
    const t2 = makeTicket(2, t1.currentHash)
    const t3 = makeTicket(3, t2.currentHash)
    const result = verifyTicketChain([t1, t2, t3])
    expect(result).toEqual({ isValid: true, brokenLinks: [] })
  })

  // T4 — Hash actuel corrompu (fraude directe)
  it('T4 — détecte un currentHash corrompu sur un ticket intermédiaire', () => {
    const t1 = makeTicket(1, null)
    const t2 = makeTicket(2, t1.currentHash)
    const t3 = makeTicket(3, t2.currentHash)

    const t2Tampered = { ...t2, currentHash: 'tampered-hash-000000000000000000000000000000' }

    const result = verifyTicketChain([t1, t2Tampered, t3])
    expect(result.isValid).toBe(false)
    expect(result.brokenLinks.some(b => b.ticketNumber === t2.ticketNumber)).toBe(true)
  })

  // T5 — Lien cassé entre tickets (ticket inséré ou supprimé)
  it('T5 — détecte un lien cassé (previousHash du ticket 3 ne correspond pas au currentHash du ticket 2)', () => {
    const t1 = makeTicket(1, null)
    const t2 = makeTicket(2, t1.currentHash)
    const t3 = makeTicket(3, t2.currentHash)

    const t3WithWrongPrev = { ...t3, previousHash: 'wrong-previous-hash' }

    const result = verifyTicketChain([t1, t2, t3WithWrongPrev])
    expect(result.isValid).toBe(false)
    expect(result.brokenLinks.some(b => b.ticketNumber === t3.ticketNumber)).toBe(true)
  })

  // T6 — Double rupture
  it('T6 — détecte deux ruptures simultanées dans la chaîne', () => {
    const t1 = makeTicket(1, null)
    const t2 = makeTicket(2, t1.currentHash)
    const t3 = makeTicket(3, t2.currentHash)

    const t2Tampered = { ...t2, currentHash: 'tampered-t2-hash-0000000000000000000000000' }
    const t3Tampered = { ...t3, currentHash: 'tampered-t3-hash-0000000000000000000000000' }

    const result = verifyTicketChain([t1, t2Tampered, t3Tampered])
    expect(result.isValid).toBe(false)
    // Au moins 2 entrées dans brokenLinks (t2 corrompu + lien t3→t2 cassé + t3 corrompu)
    expect(result.brokenLinks.length).toBeGreaterThanOrEqual(2)
  })

  // T7 — Ordre inversé
  it('T7 — chaîne dans l\'ordre inversé → isValid: false (lien t1.previousHash ≠ t2.currentHash)', () => {
    const t1 = makeTicket(1, null)
    const t2 = makeTicket(2, t1.currentHash)
    const t3 = makeTicket(3, t2.currentHash)

    // On inverse l'ordre : [t3, t2, t1]
    // t2.previousHash = t3.currentHash ? Non → lien cassé
    const result = verifyTicketChain([t3, t2, t1])
    expect(result.isValid).toBe(false)
  })

  // T8 — Ticket annulé retiré de la chaîne
  it('T8 — supprimer un ticket intermédiaire de la chaîne → lien cassé', () => {
    const t1 = makeTicket(1, null)
    const t2 = makeTicket(2, t1.currentHash)
    const t3 = makeTicket(3, t2.currentHash)

    // On retire t2 : t3.previousHash = t2.currentHash ≠ t1.currentHash
    const result = verifyTicketChain([t1, t3])
    expect(result.isValid).toBe(false)
    expect(result.brokenLinks.some(b => b.ticketNumber === t3.ticketNumber)).toBe(true)
  })
})
