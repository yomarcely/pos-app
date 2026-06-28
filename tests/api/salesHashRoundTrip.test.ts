import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

/**
 * Test d'intégration "round-trip" NF525 (P1.2) :
 * 1. On exécute le vrai handler POST /api/sales/create (vrai generateTicketHash,
 *    DB mockée qui capture les valeurs insérées dans `sales` et `sale_items`).
 * 2. On simule le stockage PostgreSQL : decimal → string → Number (exactement
 *    comme le fait verify-chain.get.ts), et la saleDate relue depuis la DB.
 * 3. On recalcule le hash depuis ces valeurs "relues" (reconstruction identique
 *    à verify-chain.get.ts) et on vérifie qu'il est égal au currentHash stocké.
 *
 * Régression couverte : le hash était calculé avec un `new Date()` et la vente
 * insérée avec un AUTRE `new Date()` → la date hashée n'était jamais stockée et
 * verify-chain signalait quasiment chaque ticket comme corrompu. Le stub Date
 * "ticking" (+1 ms par construction) rend cette divergence déterministe : ce
 * test échoue tant que create.post.ts n'utilise pas UNE seule instance Date.
 */

// Override createError (auto-import Nitro)
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

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
  createSaleRequestSchema: {},
}))

vi.mock('~/server/utils/audit', () => ({
  logSaleCreation: vi.fn(() => Promise.resolve()),
  logSystemError: vi.fn(() => Promise.resolve()),
}))

vi.mock('~/server/utils/loyalty', () => ({
  getActiveLoyaltyConfig: vi.fn(() => Promise.resolve(null)),
  calculatePointsForSale: vi.fn(() => 0),
  getCustomerLoyaltyPoints: vi.fn(() => Promise.resolve(0)),
}))

// ⚠️ NE PAS mocker ~/server/utils/nf525 : le but est de tester le vrai hash.

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
  gt: (...args: unknown[]) => ({ type: 'gt', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
}))

// Tables mockées : l'identité de l'objet sert de clé pour router les SELECT/INSERT
const tables = {
  sales: { id: 's.id', tenantId: 's.tenantId', ticketNumber: 's.ticketNumber', currentHash: 's.currentHash', registerId: 's.registerId', establishmentId: 's.establishmentId', saleDate: 's.saleDate' },
  saleItems: { id: 'si.id', saleId: 'si.saleId' },
  stockMovements: { id: 'sm.id' },
  products: { id: 'p.id', tenantId: 'p.tenantId', purchasePrice: 'p.purchasePrice' },
  productEstablishments: { productId: 'pe.productId', establishmentId: 'pe.establishmentId', tenantId: 'pe.tenantId', purchasePriceOverride: 'pe.purchasePriceOverride' },
  variations: { id: 'v.id', name: 'v.name' },
  registers: { id: 'r.id', tenantId: 'r.tenantId', establishmentId: 'r.establishmentId', name: 'r.name', registerNumber: 'r.registerNumber', isActive: 'r.isActive' },
  establishments: { id: 'e.id', tenantId: 'e.tenantId', name: 'e.name', establishmentNumber: 'e.establishmentNumber', isActive: 'e.isActive' },
  closures: { id: 'c.id', tenantId: 'c.tenantId', closureDate: 'c.closureDate', registerId: 'c.registerId' },
  productStocks: { productId: 'ps.productId', establishmentId: 'ps.establishmentId', tenantId: 'ps.tenantId' },
  customers: { id: 'cu.id', tenantId: 'cu.tenantId', loyaltyProgram: 'cu.loyaltyProgram' },
  customerEstablishments: { id: 'ce.id' },
  loyaltyVouchers: { id: 'lv.id' },
}

vi.mock('~/server/database/schema', () => tables)

// Captures des INSERT
let insertedSale: Record<string, unknown> | null = null
let insertedSaleItems: Array<Record<string, unknown>> = []

const readResults = new Map<unknown, unknown[]>([
  [tables.registers, [{ id: 1, tenantId: 'test-tenant-id', establishmentId: 1, name: 'Caisse 1', registerNumber: 2 }]],
  [tables.establishments, [{ id: 1, name: 'Boutique', establishmentNumber: 1 }]],
])

function makeQueryRunner() {
  function selectChain() {
    let fromTable: unknown = null
     
    const chain: any = {
      from: vi.fn((t: unknown) => { fromTable = t; return chain }),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(readResults.get(fromTable) || []).then(resolve, reject),
    }
    return chain
  }

   
  const runner: any = {
    select: vi.fn(() => selectChain()),
    execute: vi.fn(() => Promise.resolve()),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: Record<string, unknown> | Array<Record<string, unknown>>) => {
        if (table === tables.sales && !Array.isArray(vals)) insertedSale = vals
        if (table === tables.saleItems && Array.isArray(vals)) insertedSaleItems = vals
        return {
          returning: vi.fn(() => Promise.resolve([{ id: 1, ...(Array.isArray(vals) ? {} : vals) }])),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject),
        }
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    })),
  }
  runner.transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(runner))
  return runner
}

 
let currentDb: any
vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb },
}))

// Stub Date "ticking" : chaque `new Date()` sans argument avance d'1 ms.
// Garantit que deux instanciations distinctes ne tombent jamais sur la même ms.
const RealDate = Date
const BASE_TIME = new RealDate('2026-06-12T10:00:00.000Z').getTime()

function installTickingDate() {
  let tick = 0
  class TickingDate extends RealDate {
     
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(BASE_TIME + tick++)
      }
      else {
         
        super(...(args as [any]))
      }
    }

    static override now() { return BASE_TIME + tick }
  }
  vi.stubGlobal('Date', TickingDate)
}

describe('NF525 — round-trip hash création → stockage → vérification', () => {
  beforeEach(() => {
    vi.resetModules()
    insertedSale = null
    insertedSaleItems = []
    currentDb = makeQueryRunner()
    installTickingDate()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('le hash recalculé depuis les données stockées (decimal → string → Number) est identique au currentHash', async () => {
     
    const handler = (await import('~/server/api/sales/create.post')).default as any
    const { generateTicketHash } = await import('~/server/utils/nf525')

    const event = createMockEvent({
      body: {
        items: [
          { productId: 1, productName: 'Produit A', quantity: 2, unitPrice: 10.5, discount: 0, discountType: '%', tva: 20 },
          { productId: 2, productName: 'Produit B', quantity: 1, unitPrice: 5, discount: 1, discountType: '€', tva: 5.5 },
        ],
        seller: { id: 7, name: 'Alice' },
        customer: null,
        payments: [{ mode: 'cash', amount: 26 }],
        totals: { totalHT: 22.24, totalTVA: 3.76, totalTTC: 26 },
        globalDiscount: { value: 0, type: '%' },
        establishmentId: 1,
        registerId: 1,
      },
    })

    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(insertedSale).not.toBeNull()
    expect(insertedSaleItems.length).toBe(2)

    const sale = insertedSale as Record<string, unknown>

    // ── Simulation du stockage PostgreSQL ──────────────────────────────────
    // decimal → string en DB, puis relu et converti via Number() par verify-chain.
    // La saleDate fait un round-trip timestamp(tz) : PG conserve les ms.
    const storedSaleDate = new Date((sale.saleDate as Date).toISOString())

    const recoveredItems = insertedSaleItems.map(item => ({
      productId: item.productId as number,
      quantity: item.quantity as number,
      unitPrice: Number(item.unitPrice), // string en DB
      totalTTC: Number(item.totalTTC),
      tva: Number(item.tva),
      discount: Number(item.discount),
      discountType: item.discountType as '%' | '€',
    }))

    // ── Reconstruction identique à verify-chain.get.ts ─────────────────────
    const recalculatedHash = generateTicketHash(
      {
        ticketNumber: sale.ticketNumber as string,
        saleDate: storedSaleDate,
        totalTTC: Number(sale.totalTTC),
        totalHT: Number(sale.totalHT),
        totalTVA: Number(sale.totalTVA),
        sellerId: sale.sellerId as number,
        establishmentNumber: Number((sale.ticketNumber as string).match(/-E(\d+)-/)?.[1]),
        registerNumber: Number((sale.ticketNumber as string).match(/-R(\d+)-/)?.[1]),
        globalDiscount: Number(sale.globalDiscount || 0),
        globalDiscountType: (sale.globalDiscountType as '%' | '€') || '€',
        items: recoveredItems,
        payments: sale.payments as Array<{ mode: string, amount: number }>,
      },
      sale.previousHash as string | null,
    )

    expect(recalculatedHash).toBe(sale.currentHash)
  })

  it('la saleDate stockée est exactement celle qui a été hashée (une seule instance Date)', async () => {
     
    const handler = (await import('~/server/api/sales/create.post')).default as any
    const { generateTicketHash } = await import('~/server/utils/nf525')

    const event = createMockEvent({
      body: {
        items: [{ productId: 1, productName: 'Produit A', quantity: 1, unitPrice: 12, discount: 0, discountType: '%', tva: 20 }],
        seller: { id: 7, name: 'Alice' },
        customer: null,
        payments: [{ mode: 'card', amount: 12 }],
        totals: { totalHT: 10, totalTVA: 2, totalTTC: 12 },
        globalDiscount: { value: 0, type: '%' },
        establishmentId: 1,
        registerId: 1,
      },
    })

    await handler(event)
    const sale = insertedSale as Record<string, unknown>

    // Hash recalculé avec la date stockée décalée d'1 ms → doit ÊTRE DIFFÉRENT,
    // preuve que la moindre divergence de date casse le hash (et donc que la
    // date stockée doit être strictement celle hashée).
    const shiftedDate = new Date((sale.saleDate as Date).getTime() + 1)
    const baseTicket = {
      ticketNumber: sale.ticketNumber as string,
      totalTTC: Number(sale.totalTTC),
      totalHT: Number(sale.totalHT),
      totalTVA: Number(sale.totalTVA),
      sellerId: sale.sellerId as number,
      establishmentNumber: 1,
      registerNumber: 2,
      globalDiscount: 0,
      globalDiscountType: '%' as const,
      items: insertedSaleItems.map(item => ({
        productId: item.productId as number,
        quantity: item.quantity as number,
        unitPrice: Number(item.unitPrice),
        totalTTC: Number(item.totalTTC),
        tva: Number(item.tva),
        discount: Number(item.discount),
        discountType: item.discountType as '%' | '€',
      })),
      payments: sale.payments as Array<{ mode: string, amount: number }>,
    }

    const hashWithStoredDate = generateTicketHash({ ...baseTicket, saleDate: sale.saleDate as Date }, sale.previousHash as string | null)
    const hashWithShiftedDate = generateTicketHash({ ...baseTicket, saleDate: shiftedDate }, sale.previousHash as string | null)

    expect(hashWithStoredDate).toBe(sale.currentHash)
    expect(hashWithShiftedDate).not.toBe(sale.currentHash)
  })
})
