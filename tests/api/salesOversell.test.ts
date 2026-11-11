import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'
import { logger } from '~/server/utils/logger'

// Override createError (comme sales.test.ts) pour que rejects.toMatchObject fonctionne
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

// A5 — Sentry mocké : on vérifie le câblage de l'alerte « survente en rafale »
// dans le handler, et surtout qu'une panne de Sentry ne fait pas échouer une vente.
const captureMessage = vi.fn()
vi.mock('@sentry/nuxt', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}))

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
  products: { __table: 'products', id: 'products.id', tenantId: 'products.tenantId', purchasePrice: 'products.purchasePrice' },
  productEstablishments: { __table: 'productEstablishments', productId: 'pe.productId', establishmentId: 'pe.establishmentId', tenantId: 'pe.tenantId', purchasePriceOverride: 'pe.purchasePriceOverride' },
  variations: { __table: 'variations', id: 'variations.id', name: 'variations.name' },
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

// ===========================================
// Mock DB : selects séquentiels + capture des inserts/updates
// ===========================================

interface CapturedInsert { table: string; values: unknown }
interface CapturedUpdate { table: string; set: Record<string, unknown> }

function createSaleDb(selectResults: unknown[][]) {
  const inserted: CapturedInsert[] = []
  const updated: CapturedUpdate[] = []
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
    insert: vi.fn((table: { __table: string }) => ({
      values: (values: unknown) => {
        inserted.push({ table: table.__table, values })
        return {
          returning: () => Promise.resolve([{ id: 42, ticketNumber: '20240115-E01-R01-000001', saleDate: new Date(), totalTTC: '10.00', currentHash: 'mock-hash-abc123', signature: 'mock-signature-xyz' }]),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject),
        }
      },
    })),
    update: vi.fn((table: { __table: string }) => ({
      set: (set: Record<string, unknown>) => {
        updated.push({ table: table.__table, set })
        return {
          where: () => ({
            then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
              Promise.resolve(undefined).then(resolve, reject),
          }),
        }
      },
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  }
  return { db, inserted, updated }
}

const register = { id: 1, tenantId: 'test-tenant-id', establishmentId: 10, name: 'Caisse 1', registerNumber: 1 }
const establishment = { id: 10, name: 'Boutique', establishmentNumber: 1 }

/**
 * Résultats des SELECT dans l'ordre d'exécution du handler (sans client ni voucher) :
 * 1. register, 2. establishment, 3. closure du jour,
 * 4. garde clôture (dernière vente avant aujourd'hui — vide ici : garde passante),
 * puis en transaction : 5. lastSale, 6. lastTicket,
 * 7. basePurchasePrices, 8. overridePurchasePrices, 9. allProductStocks
 */
function buildSelects(stockRows: unknown[]): unknown[][] {
  return [[register], [establishment], [], [], [], [], [], [], stockRows]
}

function buildBody(items: Array<{ productId: number; productName: string; quantity: number; variation?: string }>) {
  return {
    items: items.map(i => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: 10,
      variation: i.variation,
      discount: 0,
      discountType: '%' as const,
      tva: 20,
    })),
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
async function runSale(stockRows: unknown[], items: any[]) {
  const { db, inserted, updated } = createSaleDb(buildSelects(stockRows))
  currentDb = db
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (await import('~/server/api/sales/create.post')).default as any
  const response = await handler(createMockEvent({ body: buildBody(items) }))
  return { response, inserted, updated }
}

function getStockMovements(inserted: CapturedInsert[]) {
  const entry = inserted.find(i => i.table === 'stockMovements')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (entry?.values || []) as any[]
}

// ===========================================
// Tests
// ===========================================

// ===========================================
// A5 — alerte « survente en rafale » : câblage dans le handler
// ===========================================
// Le compteur (oversellMonitor) et le reporter (nf525Alerting) sont testés en
// unitaire ; ici on vérifie leur branchement dans la vente. vi.resetModules()
// repart d'un compteur et d'un throttle vierges à chaque test.

describe('POST /api/sales/create — alerte de survente en rafale (A5)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(logger.warn).mockClear()
    captureMessage.mockReset()
  })

  /** `n` produits distincts à stock nul, vendus à 1 exemplaire : `n` lignes en survente. */
  function oversoldLines(n: number) {
    const ids = Array.from({ length: n }, (_, i) => i + 1)
    return {
      stockRows: ids.map(id => ({ productId: id, stock: 0, stockByVariation: null })),
      items: ids.map(id => ({ productId: id, productName: `Article ${id}`, quantity: 1 })),
    }
  }

  it('sous le seuil : la survente ne remonte aucune alerte', async () => {
    const { stockRows, items } = oversoldLines(5)

    const { response } = await runSale(stockRows, items)

    expect(response.success).toBe(true)
    expect(response.stockWarnings).toHaveLength(5)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('seuil franchi : une alerte warning part, et la vente réussit', async () => {
    const { stockRows, items } = oversoldLines(6)

    const { response } = await runSale(stockRows, items)

    expect(response.success).toBe(true)
    expect(response.stockWarnings).toHaveLength(6)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [message, ctx] = captureMessage.mock.calls[0] as [string, { level: string; tags: Record<string, string>; extra: Record<string, unknown> }]
    expect(message).toContain('Survente en rafale')
    expect(ctx.level).toBe('warning')
    expect(ctx.tags.scope).toBe('stock-oversell')
    expect(ctx.tags.tenantId).toBe('test-tenant-id')
    expect(ctx.extra).toMatchObject({ establishmentId: 10, oversellCount: 6 })
  })

  it('une panne Sentry ne fait PAS échouer la vente : même réponse qu’avec Sentry en état', async () => {
    const { stockRows, items } = oversoldLines(6)
    // Horloge figée : les deux ventes portent la même date, la comparaison des
    // réponses ne dépend pas de la milliseconde.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-10T10:00:00Z'))

    try {
      const reference = await runSale(stockRows, items)
      // La vente de référence a bien émis l'alerte : les deux ventes passent
      // par la même branche, seule la santé de Sentry diffère.
      expect(captureMessage).toHaveBeenCalledTimes(1)

      vi.resetModules()
      captureMessage.mockReset()
      captureMessage.mockImplementation(() => {
        throw new Error('Sentry transport down')
      })
      const withSentryDown = await runSale(stockRows, items)

      expect(captureMessage).toHaveBeenCalledTimes(1)
      expect(withSentryDown.response.success).toBe(true)
      expect(withSentryDown.response).toEqual(reference.response)
      // Mêmes écritures en base, valeurs comprises (vente, lignes, mouvements de stock).
      expect(withSentryDown.inserted).toEqual(reference.inserted)
      expect(withSentryDown.updated).toEqual(reference.updated)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('POST /api/sales/create — décrément de stock et survente', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(logger.warn).mockClear()
  })

  it('stock suffisant : décrémente sans survente (oversell=false)', async () => {
    const { response, inserted } = await runSale(
      [{ productId: 1, stock: 10, stockByVariation: null }],
      [{ productId: 1, productName: 'T-shirt', quantity: 2 }],
    )

    expect(response.success).toBe(true)
    const movements = getStockMovements(inserted)
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({
      productId: 1,
      quantity: -2,
      oldStock: 10,
      newStock: 8,
      reason: 'sale',
      oversell: false,
    })
    expect(response.stockWarnings).toEqual([])
  })

  it('survente sur stock principal : la vente passe, flag oversell + warning + stockWarnings', async () => {
    const { response, inserted, updated } = await runSale(
      [{ productId: 1, stock: 1, stockByVariation: null }],
      [{ productId: 1, productName: 'T-shirt', quantity: 4 }],
    )

    // La vente passe quand même
    expect(response.success).toBe(true)

    // Le stock devient négatif (survente autorisée mais explicite)
    const stockUpdate = updated.find(u => u.table === 'productStocks')
    expect(stockUpdate?.set.stock).toBe(-3)

    // Le mouvement porte le flag oversell
    const movements = getStockMovements(inserted)
    expect(movements[0]).toMatchObject({
      productId: 1,
      oldStock: 1,
      newStock: -3,
      oversell: true,
    })

    // Warning structuré loggé
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 1, variation: null, oldStock: 1, quantity: 4 }),
      expect.stringContaining('Survente'),
    )

    // Le client sait quels articles sont en survente
    expect(response.stockWarnings).toEqual([
      expect.objectContaining({
        productId: 1,
        productName: 'T-shirt',
        variation: null,
        remainingStock: -3,
      }),
    ])
  })

  it('survente sur variation : flag oversell + warning avec la variation', async () => {
    const { response, inserted, updated } = await runSale(
      [{ productId: 2, stock: 0, stockByVariation: [{ variationId: '7', stock: 1 }] }],
      [{ productId: 2, productName: 'Chaussure', quantity: 3, variation: '7' }],
    )

    expect(response.success).toBe(true)

    // Le stock de la variation devient négatif
    const stockUpdate = updated.find(u => u.table === 'productStocks')
    expect(stockUpdate?.set.stockByVariation).toEqual([{ variationId: '7', stock: -2 }])

    const movements = getStockMovements(inserted)
    expect(movements[0]).toMatchObject({
      productId: 2,
      variation: '7',
      oldStock: 1,
      newStock: -2,
      oversell: true,
    })

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 2, variation: '7', oldStock: 1, quantity: 3 }),
      expect.stringContaining('Survente'),
    )

    expect(response.stockWarnings).toEqual([
      expect.objectContaining({
        productId: 2,
        productName: 'Chaussure',
        variation: '7',
        remainingStock: -2,
      }),
    ])
  })
})
