import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'
import { getBusinessDayString } from '~/server/utils/businessDay'

// Garde de clôture : aucune nouvelle vente tant que la dernière journée active
// (= avec au moins une vente) n'est pas clôturée pour la caisse — même si des
// jours sans activité se sont écoulés entre-temps.

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.data = data.data
  err.__isError = true
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

vi.mock('~/server/validators/sale.schema', () => ({
  createSaleRequestSchema: {},
}))

vi.mock('~/server/utils/nf525', () => ({
  generateTicketNumber: vi.fn(() => '20240115-E01-R01-000001'),
  generateTicketHash: vi.fn(() => 'mock-hash-abc123'),
  generateTicketSignature: vi.fn(() => 'mock-signature-xyz'),
}))

vi.mock('~/server/utils/audit', () => ({
  logSaleCreation: vi.fn(() => Promise.resolve()),
  logSystemError: vi.fn(() => Promise.resolve()),
}))

vi.mock('~/server/utils/financialValidation', () => ({
  recomputeTotalTTC: vi.fn(() => 10),
  validateTotalTTC: vi.fn(() => true),
  recomputeHTandTVA: vi.fn(() => ({ totalHT: 8.33, totalTVA: 1.67 })),
}))

vi.mock('~/server/utils/loyalty', () => ({
  getActiveLoyaltyConfig: vi.fn(() => Promise.resolve(null)),
  calculatePointsForSale: vi.fn(() => 0),
  getCustomerLoyaltyPoints: vi.fn(() => Promise.resolve(0)),
}))

vi.mock('~/server/utils/purchasePriceSnapshot', () => ({
  resolvePurchasePriceAtSale: vi.fn(() => null),
}))

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
  gt: (...args: unknown[]) => ({ type: 'gt', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
}))

vi.mock('~/server/database/schema', () => ({
  sales: { __table: 'sales' },
  saleItems: { __table: 'saleItems' },
  stockMovements: { __table: 'stockMovements' },
  products: { __table: 'products', id: 'products.id', tenantId: 'products.tenantId', purchasePrice: 'products.purchasePrice', variationGroupIds: 'products.variationGroupIds' },
  productEstablishments: { __table: 'productEstablishments', productId: 'pe.productId', establishmentId: 'pe.establishmentId', tenantId: 'pe.tenantId', purchasePriceOverride: 'pe.purchasePriceOverride' },
  variations: { __table: 'variations', id: 'variations.id', name: 'variations.name', tenantId: 'variations.tenantId' },
  registers: { __table: 'registers', id: 'r.id', tenantId: 'r.tenantId', establishmentId: 'r.establishmentId', name: 'r.name', registerNumber: 'r.registerNumber', isActive: 'r.isActive' },
  establishments: { __table: 'establishments', id: 'e.id', tenantId: 'e.tenantId', name: 'e.name', establishmentNumber: 'e.establishmentNumber', isActive: 'e.isActive' },
  closures: { __table: 'closures', tenantId: 'c.tenantId', closureDate: 'c.closureDate', registerId: 'c.registerId' },
  productStocks: { __table: 'productStocks', productId: 'ps.productId', establishmentId: 'ps.establishmentId', tenantId: 'ps.tenantId', stock: 'ps.stock', stockByVariation: 'ps.stockByVariation', updatedAt: 'ps.updatedAt' },
  customers: { __table: 'customers', id: 'cu.id', tenantId: 'cu.tenantId', loyaltyProgram: 'cu.loyaltyProgram' },
  customerEstablishments: { __table: 'customerEstablishments' },
  loyaltyVouchers: { __table: 'loyaltyVouchers' },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb }
}))

function createSaleDb(selectResults: unknown[][]) {
  let selectIdx = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(selectResults[selectIdx - 1] || []).then(resolve, reject),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: vi.fn(() => { selectIdx++; return chain }),
    execute: vi.fn(() => Promise.resolve()),
    insert: vi.fn(() => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: 42, ticketNumber: '20240115-E01-R01-000001', saleDate: new Date(), totalTTC: '10.00', currentHash: 'mock-hash-abc123', signature: 'mock-signature-xyz' }]),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject),
        }),
      }),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  }
  return db
}

const register = { id: 1, tenantId: 'test-tenant-id', establishmentId: 10, name: 'Caisse 1', registerNumber: 1 }
const establishment = { id: 10, name: 'Boutique', establishmentNumber: 1 }

function buildBody() {
  return {
    items: [{
      productId: 1,
      productName: 'T-shirt',
      quantity: 1,
      unitPrice: 10,
      variation: undefined,
      variationId: null,
      discount: 0,
      discountType: '%' as const,
      tva: 20,
    }],
    seller: { id: 1, name: 'Alice' },
    customer: null,
    payments: [{ mode: 'cash', amount: 10 }],
    totals: { totalHT: 8.33, totalTVA: 1.67, totalTTC: 10 },
    globalDiscount: { value: 0, type: '%' as const },
    establishmentId: 10,
    registerId: 1,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSale(selects: unknown[][]) {
  currentDb = createSaleDb(selects)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (await import('~/server/api/sales/create.post')).default as any
  return handler(createMockEvent({ body: buildBody() }))
}

// Une vente antérieure à aujourd'hui (12h UTC = pleine journée Europe/Paris,
// loin de toute frontière de jour métier)
const previousSaleDate = new Date('2026-07-01T12:00:00Z')
const previousDay = getBusinessDayString(previousSaleDate)

/**
 * Ordre des SELECT : 1. register, 2. establishment, 3. closure du jour,
 * 4. garde : dernière vente avant aujourd'hui,
 * 5. garde : clôture de cette journée (seulement si une vente a été trouvée),
 * puis en transaction : lastSale, lastTicket, basePurchasePrices,
 * overridePurchasePrices, allProductStocks
 */
describe('POST /api/sales/create — garde de clôture de la journée précédente', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('bloque (403) si la dernière journée active n\'est pas clôturée', async () => {
    await expect(runSale([
      [register],
      [establishment],
      [], // pas de clôture aujourd'hui
      [{ saleDate: previousSaleDate }], // dernière vente : journée précédente
      [], // pas de clôture pour cette journée → blocage
    ])).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining(previousDay),
    })
  })

  it('passe si la dernière journée active est clôturée', async () => {
    const response = await runSale([
      [register],
      [establishment],
      [], // pas de clôture aujourd'hui
      [{ saleDate: previousSaleDate }],
      [{ id: 99, closureDate: previousDay }], // journée clôturée → OK
      [], [], [], [], // tx : lastSale, lastTicket, base, override
      [{ productId: 1, stock: 5, stockByVariation: null }], // stocks
    ])
    expect(response.success).toBe(true)
  })

  it('passe s\'il n\'y a aucune vente antérieure (première journée d\'activité)', async () => {
    const response = await runSale([
      [register],
      [establishment],
      [], // pas de clôture aujourd'hui
      [], // aucune vente antérieure → pas de clôture exigée
      [], [], [], [], // tx : lastSale, lastTicket, base, override
      [{ productId: 1, stock: 5, stockByVariation: null }], // stocks
    ])
    expect(response.success).toBe(true)
  })
})
