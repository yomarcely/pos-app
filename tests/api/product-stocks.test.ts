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

vi.mock('~/server/validators/sync.schema', () => ({
  updateProductStockSchema: { parse: vi.fn((data: unknown) => data) },
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
}))

vi.mock('~/server/database/schema', () => ({
  productStocks: {
    id: 'ps.id', productId: 'ps.productId', establishmentId: 'ps.establishmentId',
    tenantId: 'ps.tenantId', stock: 'ps.stock', stockByVariation: 'ps.stockByVariation',
    minStock: 'ps.minStock', minStockByVariation: 'ps.minStockByVariation',
    updatedAt: 'ps.updatedAt',
  },
  products: {
    id: 'products.id', name: 'products.name', barcode: 'products.barcode',
    tenantId: 'products.tenantId',
  },
  establishments: {
    id: 'establishments.id', name: 'establishments.name',
  },
  stockMovements: {
    tenantId: 'sm.tenantId', movementId: 'sm.movementId', productId: 'sm.productId',
    variation: 'sm.variation', establishmentId: 'sm.establishmentId',
    quantity: 'sm.quantity', oldStock: 'sm.oldStock', newStock: 'sm.newStock',
    reason: 'sm.reason', userId: 'sm.userId',
  },
  movements: {
    id: 'movements.id', tenantId: 'movements.tenantId', movementNumber: 'movements.movementNumber',
    type: 'movements.type', comment: 'movements.comment', userId: 'movements.userId',
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
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return chain
}

/**
 * For product-stocks update: 2 selects + update + 2 inserts
 */
function createStockUpdateChain(product: unknown | null, currentStock: unknown | null, movement: unknown) {
  let selectIdx = 0
  const selectResults = [product ? [product] : [], currentStock ? [currentStock] : []]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(selectResults[selectIdx - 1] || []).then(resolve, reject),
  }
  return {
    select: vi.fn(() => { selectIdx++; return selectChain }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject)
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([movement])),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
  }
}

// ===========================================
// Tests
// ===========================================

describe('API /api/product-stocks', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/product-stocks
  // -----------------------------------------
  describe('GET /api/product-stocks', () => {
    it('retourne les stocks avec alertes', async () => {
      const mockStocks = [
        { id: 1, productId: 1, productName: 'Produit A', productBarcode: '123', establishmentId: 1, establishmentName: 'Boutique', stock: 3, stockByVariation: null, minStock: 5, minStockByVariation: null, updatedAt: new Date() },
        { id: 2, productId: 2, productName: 'Produit B', productBarcode: '456', establishmentId: 1, establishmentName: 'Boutique', stock: 0, stockByVariation: null, minStock: 5, minStockByVariation: null, updatedAt: new Date() },
      ]
      currentDb = createReadChain(mockStocks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/product-stocks/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.stocks).toHaveLength(2)
      expect(res.alerts).toHaveLength(2)
      expect(res.outOfStockCount).toBe(1)
      expect(res.lowStockCount).toBe(1)
    })

    it('filtre par establishmentId', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/product-stocks/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '5' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.stocks).toEqual([])
    })
  })

  // -----------------------------------------
  // POST /api/product-stocks/update
  // -----------------------------------------
  describe('POST /api/product-stocks/update', () => {
    it('met à jour le stock existant en mode add', async () => {
      const product = { id: 1, name: 'Produit A', tenantId: 'test-tenant-id' }
      const currentStock = { id: 10, productId: 1, establishmentId: 5, stock: 10, stockByVariation: null }
      const movement = { id: 100, movementNumber: 'ADJ-123' }
      currentDb = createStockUpdateChain(product, currentStock, movement)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/product-stocks/update.post')).default as any
      const event = createMockEvent({
        body: { productId: 1, establishmentId: 5, quantity: 5, adjustmentType: 'add', reason: 'reception' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.oldStock).toBe(10)
      expect(res.newStock).toBe(15)
      expect(res.message).toBe('Stock mis à jour avec succès')
    })

    it('throw 404 si produit introuvable', async () => {
      currentDb = createStockUpdateChain(null, null, {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/product-stocks/update.post')).default as any
      const event = createMockEvent({
        body: { productId: 999, establishmentId: 5, quantity: 5, adjustmentType: 'add', reason: 'reception' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Produit non trouvé'
      })
    })
  })
})
