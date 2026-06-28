import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

/**
 * ==========================================================================
 * POST /api/sales/:id/cancel — flux AVOIR NF525 (P3.2)
 * ==========================================================================
 *
 * L'annulation émet un avoir (`type='credit_note'`, montants négatifs) chaîné
 * dans la chaîne de hash. On vérifie : structure de l'avoir, chaînage, numéro de
 * séquence, round-trip du hash (vrai generateTicketHash), lien origine→avoir,
 * re-stockage au format tableau [{variationId,stock}] (bug corrigé), fix N+1,
 * et les gardes (déjà annulée → 409, annuler un avoir → 400, 404).
 *
 * Faux runner `db` : SELECT routés par IDENTITÉ de table (Map), INSERT/UPDATE
 * capturés par table ; nombre de SELECT par table compté (pour le N+1).
 * ⚠️ nf525 n'est PAS mocké : on teste le vrai hash.
 */

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'
;(globalThis as Record<string, unknown>).getRouterParam = (
  event: { context?: { params?: Record<string, string> } },
  param: string,
) => event?.context?.params?.[param]

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id'),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (_event: unknown) => {
    const event = _event as { body?: unknown }
    return event?.body || {}
  }),
}))

vi.mock('~/server/validators/sale.schema', () => ({
  cancelSaleSchema: {},
}))

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}))

// Tables mockées : l'identité de l'objet sert de clé
const tables = {
  sales: { __t: 'sales' },
  saleItems: { __t: 'saleItems' },
  stockMovements: { __t: 'stockMovements' },
  variations: { __t: 'variations' },
  productStocks: { __t: 'productStocks' },
  customerEstablishments: { __t: 'customerEstablishments' },
  loyaltyVouchers: { __t: 'loyaltyVouchers' },
  registers: { __t: 'registers' },
  establishments: { __t: 'establishments' },
  closures: { __t: 'closures' },
  auditLogs: { __t: 'auditLogs' },
}

vi.mock('~/server/database/schema', () => tables)

// Captures
let insertedByTable: Map<unknown, Array<Record<string, unknown> | Array<Record<string, unknown>>>>
let updatedByTable: Map<unknown, Array<Record<string, unknown>>>
let selectFromCount: Map<unknown, number>
let readResults: Map<unknown, unknown[]>
let creditNoteId = 999

function makeRunner() {
  function selectChain() {
    let fromTable: unknown = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      from: vi.fn((t: unknown) => {
        fromTable = t
        selectFromCount.set(t, (selectFromCount.get(t) || 0) + 1)
        return chain
      }),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(readResults.get(fromTable) || []).then(resolve, reject),
    }
    return chain
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runner: any = {
    select: vi.fn(() => selectChain()),
    execute: vi.fn(() => Promise.resolve()),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: Record<string, unknown> | Array<Record<string, unknown>>) => {
        const arr = insertedByTable.get(table) || []
        arr.push(vals)
        insertedByTable.set(table, arr)
        const returnedId = table === tables.sales ? creditNoteId : 1
        return {
          returning: vi.fn(() => Promise.resolve([{ id: returnedId, ...(Array.isArray(vals) ? {} : vals) }])),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject),
        }
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((vals: Record<string, unknown>) => {
        const arr = updatedByTable.get(table) || []
        arr.push(vals)
        updatedByTable.set(table, arr)
        return { where: vi.fn(() => Promise.resolve()) }
      }),
    })),
  }
  runner.transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(runner))
  return runner
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any
vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb },
}))

async function importHandler() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await import('~/server/api/sales/[id]/cancel.post')).default as any
}

// Helpers de fabrication des lignes lues
function baseSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenantId: 'test-tenant-id',
    ticketNumber: '20260612-E01-R01-000042',
    status: 'completed',
    type: 'sale',
    creditNoteId: null,
    establishmentId: 1,
    registerId: 1,
    saleDate: new Date('2026-06-12T09:00:00.000Z'),
    totalHT: '25.00',
    totalTVA: '5.00',
    totalTTC: '30.00',
    globalDiscount: '0',
    globalDiscountType: '%',
    sellerId: 7,
    customerId: null,
    payments: [{ mode: 'cash', amount: 30 }],
    previousHash: 'OLDPREV',
    currentHash: 'PREVHASH123',
    signature: 'sig',
    pointsEarned: 0,
    pointsConsumed: 0,
    voucherUsedId: null,
    ...overrides,
  }
}

function setReads(opts: {
  sale?: Record<string, unknown> | null
  items?: Array<Record<string, unknown>>
  productStocks?: Array<Record<string, unknown>>
  closure?: Array<Record<string, unknown>>
} = {}) {
  readResults.set(tables.sales, opts.sale === null ? [] : [opts.sale ?? baseSale()])
  readResults.set(tables.registers, [{ id: 1, registerNumber: 1, establishmentId: 1 }])
  readResults.set(tables.establishments, [{ id: 1, establishmentNumber: 1 }])
  readResults.set(tables.closures, opts.closure ?? [])
  readResults.set(tables.saleItems, opts.items ?? [
    { id: 10, saleId: 1, tenantId: 'test-tenant-id', productId: 100, productName: 'Produit A', variation: null, quantity: 2, unitPrice: '10.50', discount: '0', discountType: '%', tva: '20.00', purchasePriceAtSale: null },
  ])
  readResults.set(tables.productStocks, opts.productStocks ?? [
    { productId: 100, establishmentId: 1, tenantId: 'test-tenant-id', stock: 5, stockByVariation: null },
  ])
}

describe('POST /api/sales/:id/cancel — avoir NF525', () => {
  beforeEach(() => {
    vi.resetModules()
    insertedByTable = new Map()
    updatedByTable = new Map()
    selectFromCount = new Map()
    readResults = new Map()
    creditNoteId = 999
    currentDb = makeRunner()
  })

  it('émet un avoir credit_note négatif, chaîné, au prochain numéro de séquence', async () => {
    setReads()
    const handler = await importHandler()
    const event = createMockEvent({ params: { id: '1' }, body: { reason: 'Retour client' } })
    const res = await handler(event)

    expect(res.success).toBe(true)
    expect(res.originalSale.creditNoteId).toBe(999)

    const inserted = (insertedByTable.get(tables.sales) || [])[0] as Record<string, unknown>
    expect(inserted.type).toBe('credit_note')
    expect(inserted.status).toBe('completed')
    expect(inserted.originalSaleId).toBe(1)
    // Montants négatifs
    expect(inserted.totalTTC).toBe('-30.00')
    expect(inserted.totalHT).toBe('-25.00')
    expect(inserted.totalTVA).toBe('-5.00')
    // Chaînage : previousHash = currentHash du dernier ticket du registre
    expect(inserted.previousHash).toBe('PREVHASH123')
    // Séquence suivante : 42 → 43
    expect(inserted.ticketNumber).toMatch(/-E01-R01-000043$/)
    // Paiements négés
    expect(inserted.payments).toEqual([{ mode: 'cash', amount: -30 }])
  })

  it('le hash de l\'avoir est round-trip vérifiable (vrai generateTicketHash)', async () => {
    setReads()
    const handler = await importHandler()
    const { generateTicketHash } = await import('~/server/utils/nf525')

    await handler(createMockEvent({ params: { id: '1' }, body: { reason: 'X' } }))

    const sale = (insertedByTable.get(tables.sales) || [])[0] as Record<string, unknown>
    const items = (insertedByTable.get(tables.saleItems) || [])[0] as Array<Record<string, unknown>>

    // Reconstruction IDENTIQUE à verify-chain.get.ts (decimal → string → Number)
    const storedSaleDate = new Date((sale.saleDate as Date).toISOString())
    const recalculated = generateTicketHash(
      {
        ticketNumber: sale.ticketNumber as string,
        saleDate: storedSaleDate,
        totalTTC: Number(sale.totalTTC),
        totalHT: Number(sale.totalHT),
        totalTVA: Number(sale.totalTVA),
        sellerId: (sale.sellerId as number) || 0,
        establishmentNumber: Number((sale.ticketNumber as string).match(/-E(\d+)-/)?.[1]),
        registerNumber: Number((sale.ticketNumber as string).match(/-R(\d+)-/)?.[1]),
        globalDiscount: Number(sale.globalDiscount || 0),
        globalDiscountType: (sale.globalDiscountType as '%' | '€') || '€',
        items: items.map(it => ({
          productId: it.productId as number,
          quantity: it.quantity as number,
          unitPrice: Number(it.unitPrice),
          totalTTC: Number(it.totalTTC),
          tva: Number(it.tva),
          discount: Number(it.discount),
          discountType: it.discountType as '%' | '€',
        })),
        payments: sale.payments as Array<{ mode: string; amount: number }>,
      },
      sale.previousHash as string | null,
    )

    expect(recalculated).toBe(sale.currentHash)
    // Les lignes de l'avoir sont bien négatives
    expect(items[0]?.quantity).toBe(-2)
    expect(items[0]?.totalTTC).toBe('-21.00')
  })

  it('marque l\'origine cancelled et la lie à l\'avoir (creditNoteId)', async () => {
    setReads()
    const handler = await importHandler()
    await handler(createMockEvent({ params: { id: '1' }, body: { reason: 'Erreur' } }))

    const salesUpdates = updatedByTable.get(tables.sales) || []
    const cancelUpdate = salesUpdates.find(u => u.status === 'cancelled')
    expect(cancelUpdate).toBeDefined()
    expect(cancelUpdate?.cancellationReason).toBe('Erreur')
    expect(cancelUpdate?.cancelledAt).toBeInstanceOf(Date)
    expect(cancelUpdate?.creditNoteId).toBe(999)
  })

  it('restaure le stock par variation au format tableau [{variationId,stock}] (bug corrigé) + 1 seul SELECT productStocks (N+1)', async () => {
    setReads({
      items: [
        { id: 10, saleId: 1, tenantId: 'test-tenant-id', productId: 100, productName: 'Produit A', variation: '5', quantity: 3, unitPrice: '10.00', discount: '0', discountType: '%', tva: '20.00', purchasePriceAtSale: null },
      ],
      productStocks: [
        { productId: 100, establishmentId: 1, tenantId: 'test-tenant-id', stock: 0, stockByVariation: [{ variationId: '5', stock: 2 }] },
      ],
    })
    const handler = await importHandler()
    await handler(createMockEvent({ params: { id: '1' }, body: { reason: 'Retour' } }))

    // Le stock de la variation 5 est restauré : 2 + 3 = 5 (format tableau)
    const psUpdates = updatedByTable.get(tables.productStocks) || []
    const varUpdate = psUpdates.find(u => Array.isArray(u.stockByVariation))
    expect(varUpdate).toBeDefined()
    expect(varUpdate?.stockByVariation).toContainEqual({ variationId: '5', stock: 5 })

    // Fix N+1 : un seul SELECT sur productStocks (pré-fetch bulk)
    expect(selectFromCount.get(tables.productStocks)).toBe(1)

    // Mouvement de stock d'annulation
    const movements = (insertedByTable.get(tables.stockMovements) || [])[0] as Array<Record<string, unknown>>
    expect(movements[0]?.quantity).toBe(3)
    expect(movements[0]?.reason).toBe('sale_cancellation')
    expect(movements[0]?.saleId).toBe(999) // rattaché à l'avoir
  })

  it('renvoie 409 si la vente est déjà annulée', async () => {
    setReads({ sale: baseSale({ status: 'cancelled' }) })
    const handler = await importHandler()
    await expect(handler(createMockEvent({ params: { id: '1' }, body: { reason: 'X' } })))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('renvoie 409 si un avoir a déjà été émis (creditNoteId présent)', async () => {
    setReads({ sale: baseSale({ creditNoteId: 555 }) })
    const handler = await importHandler()
    await expect(handler(createMockEvent({ params: { id: '1' }, body: { reason: 'X' } })))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('renvoie 400 si on tente d\'annuler un avoir', async () => {
    setReads({ sale: baseSale({ type: 'credit_note' }) })
    const handler = await importHandler()
    await expect(handler(createMockEvent({ params: { id: '1' }, body: { reason: 'X' } })))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('renvoie 403 si la journée est déjà clôturée pour la caisse', async () => {
    setReads({ closure: [{ id: 1 }] })
    const handler = await importHandler()
    await expect(handler(createMockEvent({ params: { id: '1' }, body: { reason: 'X' } })))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('renvoie 404 si la vente est introuvable', async () => {
    setReads({ sale: null })
    const handler = await importHandler()
    await expect(handler(createMockEvent({ params: { id: '42' }, body: { reason: 'X' } })))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})
