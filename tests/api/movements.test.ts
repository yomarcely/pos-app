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

vi.mock('~/server/utils/createMovement', () => ({
  createMovement: vi.fn(async (type: string, comment: string) => ({
    id: 1, movementNumber: 'MOV-001', type, comment,
  }))
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb }
}))

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
}))

vi.mock('~/server/database/schema', () => ({
  products: {
    id: 'products.id', name: 'products.name', stock: 'products.stock',
    stockByVariation: 'products.stockByVariation', updatedAt: 'products.updatedAt',
  },
  stockMovements: {
    tenantId: 'sm.tenantId', movementId: 'sm.movementId', productId: 'sm.productId',
    variation: 'sm.variation', quantity: 'sm.quantity', oldStock: 'sm.oldStock',
    newStock: 'sm.newStock', reason: 'sm.reason', userId: 'sm.userId',
  },
}))

// ===========================================
// Helpers
// ===========================================

/**
 * For movements create: transaction with tx having select, update, insert
 */
function createMovementTxChain(product: unknown | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx: any = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(product ? [product] : []))
        }))
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
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
  }
  return {
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  }
}

// ===========================================
// Tests
// ===========================================

describe('API /api/movements', () => {
  beforeEach(() => { vi.resetModules() })

  describe('POST /api/movements/create', () => {
    it('crée un mouvement de stock groupé', async () => {
      const product = { id: 1, name: 'Produit A', stock: 10, stockByVariation: null }
      currentDb = createMovementTxChain(product)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/movements/create.post')).default as any
      const event = createMockEvent({
        body: {
          type: 'reception',
          comment: 'Livraison fournisseur',
          items: [{ productId: 1, quantity: 5, adjustmentType: 'add' }]
        }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.movement).toBeDefined()
      expect(res.movement.movementNumber).toBe('MOV-001')
      expect(res.details).toHaveLength(1)
      expect(res.details[0].oldStock).toBe(10)
      expect(res.details[0].newStock).toBe(15)
    })

    it('throw 400 si type manquant', async () => {
      currentDb = createMovementTxChain(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/movements/create.post')).default as any
      const event = createMockEvent({
        body: { items: [{ productId: 1, quantity: 5 }] }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Type de mouvement manquant'
      })
    })

    it('throw 400 si aucun article', async () => {
      currentDb = createMovementTxChain(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/movements/create.post')).default as any
      const event = createMockEvent({
        body: { type: 'reception', items: [] }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Aucun article dans le mouvement'
      })
    })

    it('throw 404 si produit introuvable', async () => {
      currentDb = createMovementTxChain(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/movements/create.post')).default as any
      const event = createMockEvent({
        body: {
          type: 'reception',
          items: [{ productId: 999, quantity: 5, adjustmentType: 'add' }]
        }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Produit #999 non trouvé'
      })
    })
  })
})
