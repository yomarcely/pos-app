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

vi.mock('~/server/utils/nf525', () => ({
  generateArchiveHash: vi.fn(() => 'mock-archive-hash-abc123')
}))

vi.mock('crypto', () => ({
  default: {
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'mock-signature-hex')
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
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lte: (...args: unknown[]) => ({ type: 'lte', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args })
}))

vi.mock('~/server/database/schema', () => ({
  archives: {
    id: 'archives.id', tenantId: 'archives.tenantId',
    archiveType: 'archives.archiveType', period: 'archives.period',
    periodStart: 'archives.periodStart', periodEnd: 'archives.periodEnd',
    registerId: 'archives.registerId', salesCount: 'archives.salesCount',
    closuresCount: 'archives.closuresCount', totalAmount: 'archives.totalAmount',
    archiveHash: 'archives.archiveHash', archiveSignature: 'archives.archiveSignature',
    fileSize: 'archives.fileSize', filePath: 'archives.filePath',
    metadata: 'archives.metadata', createdAt: 'archives.createdAt',
  },
  sales: {
    id: 'sales.id', tenantId: 'sales.tenantId', saleDate: 'sales.saleDate',
    registerId: 'sales.registerId', totalTTC: 'sales.totalTTC',
    ticketNumber: 'sales.ticketNumber', totalHT: 'sales.totalHT',
    totalTVA: 'sales.totalTVA', globalDiscount: 'sales.globalDiscount',
    globalDiscountType: 'sales.globalDiscountType', sellerId: 'sales.sellerId',
    customerId: 'sales.customerId', establishmentId: 'sales.establishmentId',
    payments: 'sales.payments', previousHash: 'sales.previousHash',
    currentHash: 'sales.currentHash', signature: 'sales.signature',
    status: 'sales.status',
  },
  saleItems: {
    id: 'saleItems.id', saleId: 'saleItems.saleId',
  },
  closures: {
    id: 'closures.id', tenantId: 'closures.tenantId',
    closureDate: 'closures.closureDate', registerId: 'closures.registerId',
    ticketCount: 'closures.ticketCount', cancelledCount: 'closures.cancelledCount',
    totalHT: 'closures.totalHT', totalTVA: 'closures.totalTVA', totalTTC: 'closures.totalTTC',
    paymentMethods: 'closures.paymentMethods', closureHash: 'closures.closureHash',
    firstTicketNumber: 'closures.firstTicketNumber', lastTicketNumber: 'closures.lastTicketNumber',
    lastTicketHash: 'closures.lastTicketHash', closedBy: 'closures.closedBy',
    createdAt: 'closures.createdAt',
  }
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
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return chain
}

/**
 * Archive create: 3 selects (closures, sales, saleItems per sale) + 1 insert
 * closures query → sales query → for each sale: saleItems query → insert archive
 */
function createArchiveCreateChain(closuresData: unknown[], salesData: unknown[], saleItems: unknown[], newArchive: unknown) {
  const selectResults = [closuresData, salesData]
  let selectIdx = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => { selectIdx++; return chain }),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    // Terminal: resolves based on which select we're on
    // After the first 2 selects, subsequent selects are saleItems for each sale
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const result = selectIdx <= 2 ? (selectResults[selectIdx - 1] || []) : saleItems
      return Promise.resolve(result).then(resolve, reject)
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newArchive]))
      }))
    })),
  }
  return chain
}

// ===========================================
// Tests
// ===========================================

describe('API /api/archives', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/archives
  // -----------------------------------------
  describe('GET /api/archives', () => {
    it('retourne la liste des archives', async () => {
      const mockArchives = [
        { id: 1, archiveType: 'monthly', period: '2024-01', salesCount: 50, totalAmount: '5000.00' }
      ]
      currentDb = createReadChain(mockArchives)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/archives/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.archives).toHaveLength(1)
      expect(res.count).toBe(1)
    })

    it('filtre par registerId', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/archives/index.get')).default as any
      const event = createMockEvent({ query: { registerId: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.archives).toEqual([])
    })
  })

  // -----------------------------------------
  // POST /api/archives/create
  // -----------------------------------------
  describe('POST /api/archives/create', () => {
    it('crée une archive NF525 avec hash', async () => {
      const mockClosure = {
        id: 1, closureDate: '2024-01-15', ticketCount: 10, cancelledCount: 0,
        totalHT: '400.00', totalTVA: '80.00', totalTTC: '480.00',
        paymentMethods: { cash: 200, card: 280 },
        closureHash: 'hash-closure', firstTicketNumber: 'T001', lastTicketNumber: 'T010',
        lastTicketHash: 'hash-ticket', closedBy: 'Admin', createdAt: new Date()
      }
      const mockSale = {
        id: 1, ticketNumber: 'T001', saleDate: new Date('2024-01-15'),
        totalHT: '40.00', totalTVA: '8.00', totalTTC: '48.00',
        globalDiscount: '0', globalDiscountType: '%', sellerId: 1, customerId: null,
        establishmentId: 1, registerId: 1, payments: [{ mode: 'cash', amount: 48 }],
        previousHash: null, currentHash: 'hash-1', signature: 'sig-1', status: 'completed',
      }
      const newArchive = { id: 1, period: '2024-01', fileSize: 1024, createdAt: new Date() }
      currentDb = createArchiveCreateChain([mockClosure], [mockSale], [], newArchive)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/archives/create.post')).default as any
      const event = createMockEvent({
        body: { period: '2024-01', type: 'monthly' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.archive).toBeDefined()
      expect(res.archive.archiveHash).toBe('mock-archive-hash-abc123')
      expect(res.content).toBeDefined()
    })

    it('throw 400 si period ou type manquant (remonte en 500)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/archives/create.post')).default as any
      const event = createMockEvent({
        body: { period: '2024-01' } // type manquant
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Période et type d\'archive requis'
      })
    })
  })
})
