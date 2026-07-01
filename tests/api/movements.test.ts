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

const createMovementMock = vi.fn(async (type: string, comment: string) => ({
  id: 1, movementNumber: 'MOV-001', type, comment,
}))

vi.mock('~/server/utils/createMovement', () => ({
  createMovement: createMovementMock,
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
  products: {
    id: 'products.id', name: 'products.name', stock: 'products.stock',
    stockByVariation: 'products.stockByVariation', updatedAt: 'products.updatedAt',
  },
  stockMovements: {
    tenantId: 'sm.tenantId', movementId: 'sm.movementId', productId: 'sm.productId',
    variation: 'sm.variation', quantity: 'sm.quantity', oldStock: 'sm.oldStock',
    newStock: 'sm.newStock', reason: 'sm.reason', userId: 'sm.userId',
  },
  productStocks: {
    id: 'ps.id', tenantId: 'ps.tenantId', productId: 'ps.productId',
    establishmentId: 'ps.establishmentId', stock: 'ps.stock',
    stockByVariation: 'ps.stockByVariation', updatedAt: 'ps.updatedAt',
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
    // Verrou d'avance de transaction (pg_advisory_xact_lock) — no-op en test
    execute: vi.fn(() => Promise.resolve(undefined)),
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
          // RETURNING vide → le handler retombe sur oldStock + quantityDelta
          returning: vi.fn(() => Promise.resolve([])),
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

    // Caractérisation du comportement mono-appel (inchangé par le correctif concurrence) :
    // mode 'set' → newStock = valeur absolue demandée, quantityDelta = quantity - oldStock.
    it('mode set: ajuste le stock à la valeur absolue (caractérisation)', async () => {
      const product = { id: 1, name: 'Produit A', stock: 10, stockByVariation: null }
      currentDb = createMovementTxChain(product)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/movements/create.post')).default as any
      const event = createMockEvent({
        body: {
          type: 'adjustment',
          establishmentId: 3,
          items: [{ productId: 1, quantity: 8, adjustmentType: 'set' }]
        }
      })

      const res = await handler(event)

      expect(res.details[0].oldStock).toBe(10)
      expect(res.details[0].newStock).toBe(8)
      expect(res.details[0].quantityDelta).toBe(-2)
    })

    // Caractérisation : chemin variation (read-modify-write JSONB).
    it('variation: incrémente le stock de la variation ciblée (caractérisation)', async () => {
      const product = {
        id: 1, name: 'Produit A', stock: 0,
        stockByVariation: [{ variationId: 'red', stock: 4 }],
      }
      currentDb = createMovementTxChain(product)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/movements/create.post')).default as any
      const event = createMockEvent({
        body: {
          type: 'reception',
          establishmentId: 3,
          items: [{ productId: 1, variation: 'red', quantity: 3, adjustmentType: 'add' }]
        }
      })

      const res = await handler(event)

      expect(res.details[0].oldStock).toBe(4)
      expect(res.details[0].newStock).toBe(7)
      expect(res.details[0].quantityDelta).toBe(3)
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

    it('propage supplierId, deliveryNoteNumber et establishmentId à createMovement pour une réception', async () => {
      const product = { id: 1, name: 'Produit A', stock: 10, stockByVariation: null }
      currentDb = createMovementTxChain(product)
      createMovementMock.mockClear()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/movements/create.post')).default as any
      const event = createMockEvent({
        body: {
          type: 'reception',
          comment: 'Livraison du jour',
          supplierId: 42,
          deliveryNoteNumber: 'BL-2026-001',
          establishmentId: 7,
          items: [{ productId: 1, quantity: 5, adjustmentType: 'add' }]
        }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(createMovementMock).toHaveBeenCalledWith(
        'reception',
        'Livraison du jour',
        undefined,
        'test-tenant-id',
        { supplierId: 42, deliveryNoteNumber: 'BL-2026-001', establishmentId: 7 }
      )
    })

    it('ne transmet ni supplierId ni deliveryNoteNumber pour un ajustement classique', async () => {
      const product = { id: 1, name: 'Produit A', stock: 10, stockByVariation: null }
      currentDb = createMovementTxChain(product)
      createMovementMock.mockClear()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/movements/create.post')).default as any
      const event = createMockEvent({
        body: {
          type: 'adjustment',
          items: [{ productId: 1, quantity: 8, adjustmentType: 'set' }]
        }
      })

      await handler(event)

      expect(createMovementMock).toHaveBeenCalledWith(
        'adjustment',
        undefined,
        undefined,
        'test-tenant-id',
        { supplierId: null, deliveryNoteNumber: null, establishmentId: null }
      )
    })
  })
})
