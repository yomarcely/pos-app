import { describe, it, expect } from 'vitest'
import { generateTicketHash } from '~/server/utils/nf525'
import type { TicketData } from '~/server/utils/nf525'

// ─── Fixture ─────────────────────────────────────────────────────────────────

const baseTicket: TicketData = {
  ticketNumber: '20250120-E01-R01-000001',
  saleDate: new Date('2025-01-20T10:00:00.000Z'),
  sellerId: 1,
  establishmentNumber: 1,
  registerNumber: 1,
  totalTTC: 10,
  totalHT: 8.33,
  totalTVA: 1.67,
  items: [
    {
      productId: 1,
      quantity: 1,
      unitPrice: 10,
      totalTTC: 10,
      tva: 20,
      tvaCode: 'TVA20',
    },
  ],
  payments: [{ mode: 'cash', amount: 10 }],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateTicketHash', () => {
  // T1 — Premier ticket (previousHash null)
  it('T1 — retourne une string hex de 64 caractères pour le premier ticket', () => {
    const hash = generateTicketHash(baseTicket, null)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('T1 — le résultat ne contient pas "undefined" ou "null"', () => {
    const hash = generateTicketHash(baseTicket, null)
    expect(hash).not.toContain('undefined')
    expect(hash).not.toContain('null')
  })

  // T2 — Ticket chaîné
  it('T2 — le hash change quand previousHash est fourni', () => {
    const hash1 = generateTicketHash(baseTicket, null)
    const hash2 = generateTicketHash(baseTicket, hash1)
    expect(hash1).not.toBe(hash2)
  })

  // T3 — Déterminisme (idempotence)
  it('T3 — deux appels identiques produisent le même hash (déterminisme)', () => {
    const hash1 = generateTicketHash(baseTicket, null)
    const hash2 = generateTicketHash(baseTicket, null)
    expect(hash1).toBe(hash2)
  })

  it('T3 — déterminisme avec previousHash chaîné', () => {
    const prev = 'abc123def456'
    const hash1 = generateTicketHash(baseTicket, prev)
    const hash2 = generateTicketHash(baseTicket, prev)
    expect(hash1).toBe(hash2)
  })

  // T4 — Unicité — mutation totalTTC
  it('T4 — modifier totalTTC produit un hash différent', () => {
    const hash1 = generateTicketHash(baseTicket, null)
    const hash2 = generateTicketHash({ ...baseTicket, totalTTC: 11 }, null)
    expect(hash1).not.toBe(hash2)
  })

  // T5 — Unicité — mutation sellerId
  it('T5 — modifier sellerId produit un hash différent', () => {
    const hash1 = generateTicketHash(baseTicket, null)
    const hash2 = generateTicketHash({ ...baseTicket, sellerId: 2 }, null)
    expect(hash1).not.toBe(hash2)
  })

  // T6 — Unicité — mutation date
  it('T6 — modifier saleDate produit un hash différent', () => {
    const hash1 = generateTicketHash(baseTicket, null)
    const hash2 = generateTicketHash({ ...baseTicket, saleDate: new Date('2025-01-21T10:00:00.000Z') }, null)
    expect(hash1).not.toBe(hash2)
  })

  // T7 — Avec globalDiscount
  it('T7 — présence de globalDiscount produit un hash différent de son absence', () => {
    const hash1 = generateTicketHash(baseTicket, null) // globalDiscount absent
    const hash2 = generateTicketHash({ ...baseTicket, globalDiscount: 5, globalDiscountType: '%' }, null)
    expect(hash1).not.toBe(hash2)
  })

  // T8 — Fallback tvaCode absent
  it('T8 — item sans tvaCode utilise le fallback TVA${tva} sans erreur', () => {
    const ticketWithoutTvaCode: TicketData = {
      ...baseTicket,
      items: [
        {
          productId: 1,
          quantity: 1,
          unitPrice: 10,
          totalTTC: 10,
          tva: 20,
          // tvaCode absent intentionnellement
        },
      ],
    }
    const hash = generateTicketHash(ticketWithoutTvaCode, null)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('T8 — tvaCode fourni produit un hash différent du fallback TVA${tva}', () => {
    const withTvaCode: TicketData = {
      ...baseTicket,
      items: [{ ...baseTicket.items[0]!, tvaCode: 'T1' }],
    }
    const withFallback: TicketData = {
      ...baseTicket,
      items: [{ ...baseTicket.items[0]!, tvaCode: undefined }],
    }
    // T1 !== TVA20 donc les hashes doivent différer
    expect(generateTicketHash(withTvaCode, null)).not.toBe(generateTicketHash(withFallback, null))
  })

  // T9 — Séparateurs dans les données (cas limite)
  it('T9 — ticketNumber avec chiffres variés reste déterministe', () => {
    const ticketA: TicketData = { ...baseTicket, ticketNumber: '20250120-E01-R01-000001' }
    const ticketB: TicketData = { ...baseTicket, ticketNumber: '20250120-E01-R01-000002' }
    const hashA1 = generateTicketHash(ticketA, null)
    const hashA2 = generateTicketHash(ticketA, null)
    const hashB = generateTicketHash(ticketB, null)
    expect(hashA1).toBe(hashA2) // déterminisme
    expect(hashA1).not.toBe(hashB) // unicité
  })
})
