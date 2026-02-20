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

vi.mock('~/server/validators/brand.schema', () => ({
  createBrandSchema: {},
  CreateBrandInput: {}
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
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args })
}))

vi.mock('~/server/database/schema', () => ({
  brands: {
    id: 'brands.id', name: 'brands.name', tenantId: 'brands.tenantId',
    isArchived: 'brands.isArchived', createdByEstablishmentId: 'brands.createdByEstablishmentId',
  },
  syncGroupEstablishments: {
    id: 'sge.id', syncGroupId: 'sge.syncGroupId',
    establishmentId: 'sge.establishmentId', tenantId: 'sge.tenantId',
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

function createSyncFilterChain(syncGroupIds: unknown[], groupEstablishments: unknown[], resultRows: unknown[]) {
  const results = syncGroupIds.length > 0
    ? [syncGroupIds, groupEstablishments, resultRows]
    : [syncGroupIds, resultRows]
  let callIdx = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => { callIdx++; return chain }),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(results[callIdx - 1] || []).then(resolve, reject),
  }
  return chain
}

function createInsertChain(newItem: unknown) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newItem]))
      }))
    })),
  }
}

// ===========================================
// Tests
// ===========================================

describe('API /api/brands', () => {
  beforeEach(() => { vi.resetModules() })

  describe('GET /api/brands', () => {
    it('retourne la liste des marques', async () => {
      const mockBrands = [
        { id: 1, name: 'Nike', tenantId: 'test-tenant-id' },
        { id: 2, name: 'Adidas', tenantId: 'test-tenant-id' }
      ]
      currentDb = createReadChain(mockBrands)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/brands/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res).toHaveLength(2)
      expect(res[0]).toMatchObject({ id: 1, name: 'Nike' })
    })

    it('filtre par establishmentId via syncGroupEstablishments', async () => {
      const mockBrands = [{ id: 1, name: 'Nike' }]
      currentDb = createSyncFilterChain(
        [{ syncGroupId: 10 }],
        [{ establishmentId: 5 }, { establishmentId: 6 }],
        mockBrands
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/brands/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '5' } })

      const res = await handler(event)

      expect(res).toEqual(mockBrands)
      expect(currentDb.select).toHaveBeenCalledTimes(3)
    })

    it('filtre par establishmentId seul si aucun syncGroup', async () => {
      const mockBrands = [{ id: 1, name: 'Nike' }]
      currentDb = createSyncFilterChain([], [], mockBrands)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/brands/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '5' } })

      const res = await handler(event)

      expect(res).toEqual(mockBrands)
      expect(currentDb.select).toHaveBeenCalledTimes(2)
    })
  })

  describe('POST /api/brands/create', () => {
    it('crée une marque et retourne le résultat', async () => {
      const newBrand = { id: 1, name: 'Nike', tenantId: 'test-tenant-id' }
      currentDb = createInsertChain(newBrand)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/brands/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Nike' },
        query: { establishmentId: '5' }
      })

      const res = await handler(event)

      expect(res).toMatchObject({ id: 1, name: 'Nike' })
      expect(currentDb.insert).toHaveBeenCalled()
    })
  })
})
