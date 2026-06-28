import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

/**
 * verify-chain.get.ts doit valider une chaîne contenant un AVOIR (credit_note,
 * montants négatifs). Le hash est calculé avec le VRAI generateTicketHash (qui
 * gère les négatifs via toFixed), puis le handler reconstruit et revérifie.
 *
 * Faux runner : 1 SELECT sales (toute la chaîne) puis 1 SELECT saleItems par
 * vente (consommés dans l'ordre via une file).
 */

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'
;(globalThis as Record<string, unknown>).getQuery = (event: { query?: Record<string, unknown> }) => event?.query || {}

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id'),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

vi.mock('~/server/utils/audit', () => ({
  logChainVerification: vi.fn(() => Promise.resolve()),
}))

// ⚠️ nf525 NON mocké : vrai hash.

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
}))

const tables = { sales: { __t: 'sales' }, saleItems: { __t: 'saleItems' } }
vi.mock('~/server/database/schema', () => tables)

let salesData: unknown[]
let itemQueue: unknown[][]

function makeDb() {
  function selectChain() {
    let fromTable: unknown = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      from: vi.fn((t: unknown) => { fromTable = t; return chain }),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const rows = fromTable === tables.sales ? salesData : (itemQueue.shift() || [])
        return Promise.resolve(rows).then(resolve, reject)
      },
    }
    return chain
  }
  return { select: vi.fn(() => selectChain()) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any
vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb },
}))

describe('GET /api/sales/verify-chain — chaîne avec avoir (credit_note)', () => {
  beforeEach(() => {
    vi.resetModules()
    currentDb = makeDb()
  })

  it('valide une chaîne vente → avoir négatif (isValid: true)', async () => {
    const { generateTicketHash } = await import('~/server/utils/nf525')

    // Reconstruit exactement comme verify-chain.get.ts (Number sur les decimals)
    const buildHash = (
      stored: {
        ticketNumber: string; saleDate: Date; totalTTC: string; totalHT: string; totalTVA: string
        sellerId: number; globalDiscount: string; globalDiscountType: '%' | '€'
        payments: Array<{ mode: string; amount: number }>
        items: Array<{ productId: number; quantity: number; unitPrice: string; totalTTC: string; tva: string; discount: string; discountType: '%' | '€' }>
      },
      previousHash: string | null,
    ) => generateTicketHash({
      ticketNumber: stored.ticketNumber,
      saleDate: stored.saleDate,
      totalTTC: Number(stored.totalTTC),
      totalHT: Number(stored.totalHT),
      totalTVA: Number(stored.totalTVA),
      sellerId: stored.sellerId || 0,
      establishmentNumber: Number(stored.ticketNumber.match(/-E(\d+)-/)?.[1]),
      registerNumber: Number(stored.ticketNumber.match(/-R(\d+)-/)?.[1]),
      globalDiscount: Number(stored.globalDiscount || 0),
      globalDiscountType: stored.globalDiscountType,
      items: stored.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalTTC: Number(i.totalTTC),
        tva: Number(i.tva),
        discount: Number(i.discount),
        discountType: i.discountType,
      })),
      payments: stored.payments,
    }, previousHash)

    // Ticket 1 : vente normale
    const sale = {
      id: 1, ticketNumber: '20260612-E01-R01-000001', saleDate: new Date('2026-06-12T09:00:00.000Z'),
      totalTTC: '30.00', totalHT: '25.00', totalTVA: '5.00', sellerId: 7,
      globalDiscount: '0', globalDiscountType: '%' as const,
      payments: [{ mode: 'cash', amount: 30 }],
      items: [{ productId: 100, quantity: 2, unitPrice: '10.50', totalTTC: '30.00', tva: '20.00', discount: '0', discountType: '%' as const }],
    }
    const hash1 = buildHash(sale, null)

    // Ticket 2 : AVOIR (négatif), chaîné sur ticket 1
    const credit = {
      id: 2, ticketNumber: '20260612-E01-R01-000002', saleDate: new Date('2026-06-12T09:05:00.000Z'),
      totalTTC: '-30.00', totalHT: '-25.00', totalTVA: '-5.00', sellerId: 7,
      globalDiscount: '0', globalDiscountType: '%' as const,
      payments: [{ mode: 'cash', amount: -30 }],
      items: [{ productId: 100, quantity: -2, unitPrice: '10.50', totalTTC: '-30.00', tva: '20.00', discount: '0', discountType: '%' as const }],
    }
    const hash2 = buildHash(credit, hash1)

    // Lignes stockées (sales) + items par vente
    salesData = [
      { ...sale, type: 'sale', status: 'completed', previousHash: null, currentHash: hash1 },
      { ...credit, type: 'credit_note', status: 'completed', originalSaleId: 1, previousHash: hash1, currentHash: hash2 },
    ]
    itemQueue = [
      sale.items.map((i, idx) => ({ id: idx + 1, saleId: 1, ...i })),
      credit.items.map((i, idx) => ({ id: idx + 10, saleId: 2, ...i })),
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/sales/verify-chain.get')).default as any
    const res = await handler(createMockEvent({ query: {} }))

    expect(res.success).toBe(true)
    expect(res.isValid).toBe(true)
    expect(res.ticketCount).toBe(2)
    expect(res.brokenLinks).toEqual([])
  })
})
