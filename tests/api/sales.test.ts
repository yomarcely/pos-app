import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

// Override createError
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id')
}))

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }))
  }
}))

vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (_event: unknown) => {
    const event = _event as { body?: unknown }
    return event?.body || {}
  })
}))

vi.mock('~/server/validators/sale.schema', () => ({
  createSaleRequestSchema: {},
  closeDaySchema: {},
  cancelSaleSchema: {},
  CreateSaleRequestInput: {},
  CloseDayInput: {},
}))

vi.mock('~/server/utils/nf525', () => ({
  generateTicketNumber: vi.fn(() => '20240115-E01-R01-000001'),
  generateTicketHash: vi.fn(() => 'mock-hash-abc123'),
  generateTicketSignature: vi.fn(() => 'mock-signature-xyz'),
  verifyTicketChain: vi.fn(() => ({ isValid: true, brokenLinks: [] })),
}))

vi.mock('~/server/utils/audit', () => ({
  logSaleCreation: vi.fn(() => Promise.resolve()),
  logClosure: vi.fn(() => Promise.resolve()),
  logChainVerification: vi.fn(() => Promise.resolve()),
  logSystemError: vi.fn(() => Promise.resolve()),
  logSaleCancellation: vi.fn(() => Promise.resolve()),
  logAuditEvent: vi.fn(() => Promise.resolve()),
  AuditEventType: {
    SALE_CREATE: 'sale_create',
    SALE_CANCEL: 'sale_cancel',
    CLOSURE_CREATE: 'closure_create',
    SYSTEM_ERROR: 'system_error',
    CHAIN_VERIFICATION: 'chain_verification',
  }
}))

// getRequestIP est auto-importé par Nitro (global)
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

vi.mock('crypto', () => ({
  default: {
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'mock-closure-hash-hex')
      }))
    }))
  }
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb }
}))

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
  like: (...args: unknown[]) => ({ type: 'like', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
}))

vi.mock('~/server/database/schema', () => ({
  sales: {
    id: 'sales.id', tenantId: 'sales.tenantId', ticketNumber: 'sales.ticketNumber',
    saleDate: 'sales.saleDate', totalHT: 'sales.totalHT', totalTVA: 'sales.totalTVA',
    totalTTC: 'sales.totalTTC', globalDiscount: 'sales.globalDiscount',
    globalDiscountType: 'sales.globalDiscountType', sellerId: 'sales.sellerId',
    customerId: 'sales.customerId', establishmentId: 'sales.establishmentId',
    registerId: 'sales.registerId', payments: 'sales.payments',
    previousHash: 'sales.previousHash', currentHash: 'sales.currentHash',
    signature: 'sales.signature', status: 'sales.status',
    closureId: 'sales.closureId', closedAt: 'sales.closedAt',
    updatedAt: 'sales.updatedAt', cancellationReason: 'sales.cancellationReason',
    cancelledAt: 'sales.cancelledAt',
  },
  saleItems: {
    id: 'saleItems.id', saleId: 'saleItems.saleId', productId: 'saleItems.productId',
    productName: 'saleItems.productName', variation: 'saleItems.variation',
    quantity: 'saleItems.quantity', unitPrice: 'saleItems.unitPrice',
    discount: 'saleItems.discount', discountType: 'saleItems.discountType',
    tva: 'saleItems.tva', totalHT: 'saleItems.totalHT', totalTTC: 'saleItems.totalTTC',
  },
  closures: {
    id: 'closures.id', tenantId: 'closures.tenantId', closureDate: 'closures.closureDate',
    registerId: 'closures.registerId', establishmentId: 'closures.establishmentId',
    ticketCount: 'closures.ticketCount', cancelledCount: 'closures.cancelledCount',
    totalHT: 'closures.totalHT', totalTVA: 'closures.totalTVA', totalTTC: 'closures.totalTTC',
    paymentMethods: 'closures.paymentMethods', closureHash: 'closures.closureHash',
    firstTicketNumber: 'closures.firstTicketNumber', lastTicketNumber: 'closures.lastTicketNumber',
    lastTicketHash: 'closures.lastTicketHash', closedBy: 'closures.closedBy',
    closedById: 'closures.closedById', createdAt: 'closures.createdAt',
  },
  registers: {
    id: 'registers.id', tenantId: 'registers.tenantId', name: 'registers.name',
    establishmentId: 'registers.establishmentId', isActive: 'registers.isActive',
  },
  establishments: {
    id: 'establishments.id', tenantId: 'establishments.tenantId',
    name: 'establishments.name', isActive: 'establishments.isActive',
  },
  stockMovements: {
    tenantId: 'sm.tenantId', productId: 'sm.productId',
  },
  products: { id: 'products.id' },
  variations: { id: 'variations.id', name: 'variations.name' },
  productStocks: {
    productId: 'ps.productId', establishmentId: 'ps.establishmentId',
    tenantId: 'ps.tenantId', stock: 'ps.stock', stockByVariation: 'ps.stockByVariation',
    updatedAt: 'ps.updatedAt',
  },
  auditLogs: {
    tenantId: 'al.tenantId',
  },
}))

// ===========================================
// Helpers
// ===========================================

function createReadChain(rows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return chain
}

/**
 * For close-day: 3 selects (register, closure, sales) + 1 insert + 1 update
 */
function createCloseDayChain(register: unknown | null, existingClosure: unknown[], dailySales: unknown[], newClosure: unknown) {
  let selectIdx = 0
  const selectResults = [register ? [register] : [], existingClosure, dailySales]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    orderBy: vi.fn(() => selectChain),
    limit: vi.fn(() => selectChain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(selectResults[selectIdx - 1] || []).then(resolve, reject),
  }
  return {
    select: vi.fn(() => { selectIdx++; return selectChain }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newClosure])),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject)
        }))
      }))
    })),
  }
}

/**
 * For daily-summary: N sequential selects
 */
function createDailySummaryChain(results: unknown[][]) {
  let selectIdx = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => { selectIdx++; return chain }),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(results[selectIdx - 1] || []).then(resolve, reject),
  }
  return chain
}

/**
 * For verify-chain: 2+ selects (sales + saleItems per sale)
 */
function createVerifyChainDb(salesData: unknown[], saleItemsPerSale: unknown[]) {
  let selectIdx = 0
  const results = [salesData, saleItemsPerSale]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => { selectIdx++; return chain }),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(results[selectIdx - 1] || []).then(resolve, reject),
  }
  return chain
}

// ===========================================
// Tests
// ===========================================

describe('API /api/sales', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // POST /api/sales/create — validation only
  // -----------------------------------------
  describe('POST /api/sales/create', () => {
    it('throw 400 si panier vide (remonte en 500)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/create.post')).default as any
      const event = createMockEvent({
        body: {
          items: [],
          seller: { id: 1, name: 'Alice' },
          payments: [{ mode: 'cash', amount: 10 }],
          totals: { totalHT: 8.33, totalTVA: 1.67, totalTTC: 10 },
          globalDiscount: { value: 0, type: '%' },
          establishmentId: 1,
          registerId: 1,
        }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Le panier est vide'
      })
    })

    it('throw 400 si vendeur manquant (remonte en 500)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/create.post')).default as any
      const event = createMockEvent({
        body: {
          items: [{ productId: 1, productName: 'P1', quantity: 1, unitPrice: 10, discount: 0, discountType: '%', tva: 20 }],
          seller: null,
          payments: [{ mode: 'cash', amount: 10 }],
          totals: { totalHT: 8.33, totalTVA: 1.67, totalTTC: 10 },
          globalDiscount: { value: 0, type: '%' },
          establishmentId: 1,
          registerId: 1,
        }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Vendeur manquant'
      })
    })

    it('throw 400 si paiement manquant (remonte en 500)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/create.post')).default as any
      const event = createMockEvent({
        body: {
          items: [{ productId: 1, productName: 'P1', quantity: 1, unitPrice: 10, discount: 0, discountType: '%', tva: 20 }],
          seller: { id: 1, name: 'Alice' },
          payments: [],
          totals: { totalHT: 8.33, totalTVA: 1.67, totalTTC: 10 },
          globalDiscount: { value: 0, type: '%' },
          establishmentId: 1,
          registerId: 1,
        }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Mode de paiement manquant'
      })
    })

    it('throw 400 si établissement ou caisse manquant (remonte en 500)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/create.post')).default as any
      const event = createMockEvent({
        body: {
          items: [{ productId: 1, productName: 'P1', quantity: 1, unitPrice: 10, discount: 0, discountType: '%', tva: 20 }],
          seller: { id: 1, name: 'Alice' },
          payments: [{ mode: 'cash', amount: 10 }],
          totals: { totalHT: 8.33, totalTVA: 1.67, totalTTC: 10 },
          globalDiscount: { value: 0, type: '%' },
          establishmentId: 0,
          registerId: 0,
        }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Établissement ou caisse manquant'
      })
    })
  })

  // -----------------------------------------
  // GET /api/sales/check-closure
  // -----------------------------------------
  describe('GET /api/sales/check-closure', () => {
    it('retourne isClosed: true si clôture existante', async () => {
      const closure = { id: 1, closureDate: '2024-01-15', registerId: 1 }
      currentDb = createReadChain([closure])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/check-closure.get')).default as any
      const event = createMockEvent({ query: { date: '2024-01-15', registerId: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.isClosed).toBe(true)
      expect(res.closure).toBeDefined()
    })

    it('retourne isClosed: false si pas de clôture', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/check-closure.get')).default as any
      const event = createMockEvent({ query: { date: '2024-01-15' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.isClosed).toBe(false)
      expect(res.closure).toBeNull()
    })
  })

  // -----------------------------------------
  // GET /api/sales/closures
  // -----------------------------------------
  describe('GET /api/sales/closures', () => {
    it('retourne la liste des clôtures formatées', async () => {
      const mockClosures = [
        {
          id: 1, closureDate: '2024-01-15', ticketCount: 10, cancelledCount: 1,
          totalHT: '400.00', totalTVA: '80.00', totalTTC: '480.00',
          paymentMethods: { cash: 200, card: 280 }, closureHash: 'hash-1',
          firstTicketNumber: 'T001', lastTicketNumber: 'T010',
          lastTicketHash: 'hash-t10', closedBy: 'Admin', closedById: 1,
          createdAt: new Date('2024-01-15T20:00:00Z'),
        },
      ]
      currentDb = createReadChain(mockClosures)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/closures.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.closures).toHaveLength(1)
      expect(res.count).toBe(1)
      expect(res.closures[0].totalTTC).toBe(480)
      expect(res.closures[0].ticketCount).toBe(10)
    })
  })

  // -----------------------------------------
  // POST /api/sales/close-day
  // -----------------------------------------
  describe('POST /api/sales/close-day', () => {
    it('clôture la journée avec succès', async () => {
      const register = { id: 1, name: 'Caisse 1', establishmentId: 10, tenantId: 'test-tenant-id' }
      const dailySales = [
        { id: 1, status: 'completed', totalTTC: '100.00', totalHT: '83.33', totalTVA: '16.67', payments: [{ mode: 'cash', amount: 100 }], currentHash: 'hash-1', ticketNumber: 'T001' },
        { id: 2, status: 'cancelled', totalTTC: '50.00', totalHT: '41.67', totalTVA: '8.33', payments: [{ mode: 'card', amount: 50 }], currentHash: 'hash-2', ticketNumber: 'T002' },
      ]
      const newClosure = { id: 1, closureDate: '2024-01-15', closureHash: 'mock-closure-hash-hex', closedBy: 'Utilisateur', createdAt: new Date() }

      currentDb = createCloseDayChain(register, [], dailySales, newClosure)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/close-day.post')).default as any
      const event = createMockEvent({
        body: { date: '2024-01-15', registerId: 1 }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Journée clôturée avec succès')
      expect(res.closure).toBeDefined()
      expect(res.closure.ticketCount).toBe(1)
      expect(res.closure.cancelledCount).toBe(1)
      expect(res.closure.totalTTC).toBe(100)
    })

    it('throw 400 si journée déjà clôturée (remonte en 500)', async () => {
      const register = { id: 1, name: 'Caisse 1', establishmentId: 10, tenantId: 'test-tenant-id' }
      const existingClosure = [{ id: 1, closureDate: '2024-01-15', registerId: 1 }]

      currentDb = createCloseDayChain(register, existingClosure, [], {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/close-day.post')).default as any
      const event = createMockEvent({
        body: { date: '2024-01-15', registerId: 1 }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Cette journée est déjà clôturée pour cette caisse'
      })
    })

    it('throw 404 si caisse introuvable (remonte en 500)', async () => {
      currentDb = createCloseDayChain(null, [], [], {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/close-day.post')).default as any
      const event = createMockEvent({
        body: { date: '2024-01-15', registerId: 999 }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Caisse non trouvée'
      })
    })
  })

  // -----------------------------------------
  // GET /api/sales/daily-summary
  // -----------------------------------------
  describe('GET /api/sales/daily-summary', () => {
    it('retourne la synthèse journalière', async () => {
      currentDb = createDailySummaryChain([
        [{ totalTTC: '100.00', totalHT: '83.33', totalTVA: '16.67', ticketCount: 2 }], // active stats
        [{ returnCount: 0 }],                                                            // cancelled stats
        [{ totalQuantity: 5 }],                                                           // quantity stats
        [],                                                                                // daily sales (empty)
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/daily-summary.get')).default as any
      const event = createMockEvent({ query: { date: '2024-01-15' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.summary.totalTTC).toBe(100)
      expect(res.summary.ticketCount).toBe(2)
      expect(res.summary.totalQuantity).toBe(5)
      expect(res.summary.returnCount).toBe(0)
    })
  })

  // -----------------------------------------
  // GET /api/sales/verify-chain
  // -----------------------------------------
  describe('GET /api/sales/verify-chain', () => {
    it('retourne isValid: true si aucun ticket', async () => {
      currentDb = createVerifyChainDb([], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/verify-chain.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.isValid).toBe(true)
      expect(res.ticketCount).toBe(0)
      expect(res.message).toBe('Aucun ticket à vérifier')
    })

    it('vérifie la chaîne avec des tickets', async () => {
      const salesData = [{
        id: 1, ticketNumber: '20240115-E01-R01-000001', saleDate: new Date(),
        totalTTC: '100.00', totalHT: '83.33', totalTVA: '16.67',
        sellerId: 1, globalDiscount: '0', globalDiscountType: '€',
        payments: [{ mode: 'cash', amount: 100 }],
        currentHash: 'hash-1', previousHash: null, status: 'completed',
      }]
      const saleItems = [{
        id: 1, saleId: 1, productId: 1, quantity: 2, unitPrice: '50.00',
        totalTTC: '100.00', tva: '20', discount: '0', discountType: '%',
      }]
      currentDb = createVerifyChainDb(salesData, saleItems)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sales/verify-chain.get')).default as any
      const event = createMockEvent({ query: { registerId: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.isValid).toBe(true)
      expect(res.ticketCount).toBe(1)
    })
  })
})
