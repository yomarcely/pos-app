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
  like: (...args: unknown[]) => ({ type: 'like', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lte: (...args: unknown[]) => ({ type: 'lte', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args })
}))

vi.mock('~/server/database/schema', () => ({
  closures: {
    id: 'closures.id', tenantId: 'closures.tenantId',
    closureDate: 'closures.closureDate', ticketCount: 'closures.ticketCount',
    cancelledCount: 'closures.cancelledCount',
    totalHT: 'closures.totalHT', totalTVA: 'closures.totalTVA', totalTTC: 'closures.totalTTC',
    paymentMethods: 'closures.paymentMethods', closureHash: 'closures.closureHash',
    firstTicketNumber: 'closures.firstTicketNumber', lastTicketNumber: 'closures.lastTicketNumber',
    lastTicketHash: 'closures.lastTicketHash',
    closedBy: 'closures.closedBy', closedById: 'closures.closedById',
    registerId: 'closures.registerId', establishmentId: 'closures.establishmentId',
    createdAt: 'closures.createdAt',
  },
  registers: {
    id: 'registers.id', name: 'registers.name',
  },
  establishments: {
    id: 'establishments.id', name: 'establishments.name',
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
    innerJoin: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return chain
}

// ===========================================
// Tests
// ===========================================

describe('API /api/closures', () => {
  beforeEach(() => { vi.resetModules() })

  describe('GET /api/closures', () => {
    it('retourne la liste des clôtures avec success: true', async () => {
      const mockClosures = [
        { id: 1, closureDate: '2024-01-15', ticketCount: 10, totalTTC: '500.00', registerName: 'Caisse 1', establishmentName: 'Boutique' },
        { id: 2, closureDate: '2024-01-14', ticketCount: 8, totalTTC: '320.00', registerName: 'Caisse 1', establishmentName: 'Boutique' }
      ]
      currentDb = createReadChain(mockClosures)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/closures/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.closures).toHaveLength(2)
      expect(res.count).toBe(2)
      expect(currentDb.leftJoin).toHaveBeenCalledTimes(2)
    })

    it('filtre par date et registerId', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/closures/index.get')).default as any
      const event = createMockEvent({
        query: { startDate: '2024-01-01', endDate: '2024-01-31', registerId: '1' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.closures).toEqual([])
    })

    it('filtre par establishmentId', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/closures/index.get')).default as any
      const event = createMockEvent({
        query: { establishmentId: '5' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
    })
  })
})
