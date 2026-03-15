import { describe, it, expect } from 'vitest'
import { generateTicketHash, verifyTicketIntegrity } from '~/server/utils/nf525'
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

describe('verifyTicketIntegrity', () => {
  // T1 — Hash valide — premier ticket
  it('T1 — retourne true pour un premier ticket dont le hash est correct', () => {
    const hash = generateTicketHash(baseTicket, null)
    expect(verifyTicketIntegrity(baseTicket, null, hash)).toBe(true)
  })

  // T2 — Hash corrompu
  it('T2 — retourne false si les données du ticket ont été modifiées après le hash', () => {
    const hash = generateTicketHash(baseTicket, null)
    const modifiedTicket: TicketData = { ...baseTicket, totalTTC: 99 }
    expect(verifyTicketIntegrity(modifiedTicket, null, hash)).toBe(false)
  })

  // T3 — Hash correct — ticket chaîné
  it('T3 — retourne true pour un ticket chaîné dont le hash est correct', () => {
    const hash1 = generateTicketHash(baseTicket, null)
    const ticket2: TicketData = {
      ...baseTicket,
      ticketNumber: '20250120-E01-R01-000002',
    }
    const hash2 = generateTicketHash(ticket2, hash1)
    expect(verifyTicketIntegrity(ticket2, hash1, hash2)).toBe(true)
  })

  // T4 — Hash incorrect — ticket chaîné
  it('T4 — retourne false si le hash attendu est incorrect pour un ticket chaîné', () => {
    const hash1 = generateTicketHash(baseTicket, null)
    const ticket2: TicketData = {
      ...baseTicket,
      ticketNumber: '20250120-E01-R01-000002',
    }
    expect(verifyTicketIntegrity(ticket2, hash1, 'wrong-hash')).toBe(false)
  })
})
