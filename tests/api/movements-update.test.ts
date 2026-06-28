import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id'),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (_event: unknown) => (_event as { body?: unknown })?.body || {}),
}))

const logEntityUpdateMock = vi.fn(async () => {})
vi.mock('~/server/utils/audit', () => ({
  logEntityUpdate: logEntityUpdateMock,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let movementResult: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let linesResult: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let productResult: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let productStockResult: any = null

let dbSelectCallIndex = 0
const productUpdateCalls: Array<{ values: unknown }> = []
const productStocksUpdateCalls: Array<{ values: unknown }> = []
const movementsUpdateCalls: Array<{ values: unknown }> = []
const stockMovementsUpdateCalls: Array<{ values: unknown }> = []

vi.mock('~/server/database/connection', () => {
  function buildTxChain() {
    const tx = {
      select: vi.fn(() => {
        let currentTable: string | undefined
        return {
          from: vi.fn((table: { _name?: string }) => {
            currentTable = table?._name
            return {
              where: vi.fn(() => ({
                limit: vi.fn(() => {
                  if (currentTable === 'products') {
                    return Promise.resolve(productResult ? [productResult] : [])
                  }
                  if (currentTable === 'productStocks') {
                    return Promise.resolve(productStockResult ? [productStockResult] : [])
                  }
                  return Promise.resolve([])
                }),
              })),
            }
          }),
        }
      }),
      update: vi.fn((table: { _name?: string } | unknown) => ({
        set: vi.fn((values: unknown) => {
          const name = (table as { _name?: string })?._name
          if (name === 'products') productUpdateCalls.push({ values })
          else if (name === 'productStocks') productStocksUpdateCalls.push({ values })
          else if (name === 'movements') movementsUpdateCalls.push({ values })
          else if (name === 'stockMovements') stockMovementsUpdateCalls.push({ values })
          return {
            where: vi.fn(() => Promise.resolve()),
          }
        }),
      })),
    }
    return tx
  }

  return {
    db: {
      select: vi.fn(() => {
        dbSelectCallIndex++
        // 1er select : movement, 2e select : lignes
        if (dbSelectCallIndex === 1) {
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve(movementResult ? [movementResult] : [])),
              })),
            })),
          }
        }
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve(linesResult)),
          })),
        }
      }),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(buildTxChain())),
    },
  }
})

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  sql: (...args: unknown[]) => ({ type: 'sql', args }),
}))

vi.mock('~/server/database/schema', () => ({
  movements: { _name: 'movements', $inferInsert: {} },
  stockMovements: { _name: 'stockMovements', id: 'stockMovements.id', movementId: 'stockMovements.movementId', tenantId: 'stockMovements.tenantId' },
  products: { _name: 'products', id: 'products.id', tenantId: 'products.tenantId', stock: 'products.stock' },
  productStocks: { _name: 'productStocks', id: 'productStocks.id', productId: 'productStocks.productId', establishmentId: 'productStocks.establishmentId', tenantId: 'productStocks.tenantId', stock: 'productStocks.stock' },
}))

function resetState() {
  movementResult = null
  linesResult = []
  productResult = null
  productStockResult = null
  dbSelectCallIndex = 0
  productUpdateCalls.length = 0
  productStocksUpdateCalls.length = 0
  movementsUpdateCalls.length = 0
  stockMovementsUpdateCalls.length = 0
  logEntityUpdateMock.mockClear()
}

describe('PUT /api/movements/:id', () => {
  beforeEach(() => {
    vi.resetModules()
    resetState()
  })

  it('renvoie 404 si le mouvement est introuvable', async () => {
    movementResult = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any
    await expect(
      handler(createMockEvent({ params: { id: '42' }, body: { comment: 'new' } })),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuse supplierId/BL pour un mouvement non-reception', async () => {
    movementResult = {
      id: 42, tenantId: 'test-tenant-id', type: 'loss',
      comment: null, supplierId: null, deliveryNoteNumber: null,
      establishmentId: null, userId: null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any
    await expect(
      handler(createMockEvent({ params: { id: '42' }, body: { supplierId: 5 } })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuse l\'édition si une ligne provient d\'une vente', async () => {
    movementResult = {
      id: 42, tenantId: 'test-tenant-id', type: 'reception',
      comment: null, supplierId: null, deliveryNoteNumber: null,
      establishmentId: null, userId: null,
    }
    linesResult = [{ id: 1, productId: 1, quantity: 5, reason: 'sale', saleId: 99, variation: null, newStock: 5 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any
    await expect(
      handler(createMockEvent({ params: { id: '42' }, body: { comment: 'x' } })),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('refuse une ligne inexistante dans le mouvement', async () => {
    movementResult = {
      id: 42, tenantId: 'test-tenant-id', type: 'reception',
      comment: null, supplierId: null, deliveryNoteNumber: null,
      establishmentId: null, userId: null,
    }
    linesResult = [{ id: 100, productId: 1, quantity: 5, reason: 'reception', saleId: null, variation: null, newStock: 5 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any
    await expect(
      handler(createMockEvent({ params: { id: '42' }, body: { lines: [{ id: 999, quantity: 10 }] } })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('met à jour le commentaire sans toucher au stock si aucune ligne envoyée', async () => {
    movementResult = {
      id: 42, tenantId: 'test-tenant-id', type: 'reception',
      comment: 'old', supplierId: null, deliveryNoteNumber: null,
      establishmentId: null, userId: null,
    }
    linesResult = [{ id: 100, productId: 1, quantity: 5, reason: 'reception', saleId: null, variation: null, newStock: 5 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any

    const res = await handler(
      createMockEvent({ params: { id: '42' }, body: { comment: 'new comment' } }),
    )

    expect(res.success).toBe(true)
    expect(res.changedLines).toHaveLength(0)
    expect(productUpdateCalls).toHaveLength(0)
    expect(stockMovementsUpdateCalls).toHaveLength(0)
    expect(movementsUpdateCalls).toHaveLength(1)
    expect((movementsUpdateCalls[0]?.values as { comment?: string }).comment).toBe('new comment')
    expect(logEntityUpdateMock).toHaveBeenCalled()
  })

  it('refuse une modification de quantité sur un mouvement sans établissement', async () => {
    movementResult = {
      id: 42, tenantId: 'test-tenant-id', type: 'reception',
      comment: null, supplierId: null, deliveryNoteNumber: null,
      establishmentId: null, userId: null,
    }
    linesResult = [{
      id: 100, productId: 1, quantity: 5, oldStock: 0, newStock: 5,
      reason: 'reception', saleId: null, variation: null,
    }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any

    await expect(
      handler(createMockEvent({ params: { id: '42' }, body: { lines: [{ id: 100, quantity: 10 }] } })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('applique le delta de quantité sur productStocks (entrée positive)', async () => {
    movementResult = {
      id: 42, tenantId: 'test-tenant-id', type: 'reception',
      comment: null, supplierId: null, deliveryNoteNumber: null,
      establishmentId: 7, userId: null,
    }
    linesResult = [{
      id: 100, productId: 1, quantity: 5, oldStock: 0, newStock: 5,
      reason: 'reception', saleId: null, variation: null,
    }]
    productStockResult = { id: 50, productId: 1, establishmentId: 7, stock: 5, stockByVariation: null, tenantId: 'test-tenant-id' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any

    const res = await handler(
      createMockEvent({
        params: { id: '42' },
        body: { lines: [{ id: 100, quantity: 10 }] },
      }),
    )

    expect(res.success).toBe(true)
    expect(res.changedLines).toHaveLength(1)
    expect(res.changedLines[0]).toMatchObject({ id: 100, oldQuantity: 5, newQuantity: 10 })
    // products n'est plus écrit (colonne gelée) ; seul productStocks est mis à jour
    expect(productUpdateCalls).toHaveLength(0)
    expect(productStocksUpdateCalls).toHaveLength(1)
    expect(stockMovementsUpdateCalls).toHaveLength(1)
    expect((stockMovementsUpdateCalls[0]?.values as { quantity?: number }).quantity).toBe(10)
    // newStock = oldNewStock(5) + delta(5) = 10
    expect((stockMovementsUpdateCalls[0]?.values as { newStock?: number }).newStock).toBe(10)
  })

  it('préserve le signe négatif (perte) quand on change la quantité', async () => {
    movementResult = {
      id: 42, tenantId: 'test-tenant-id', type: 'loss',
      comment: null, supplierId: null, deliveryNoteNumber: null,
      establishmentId: 7, userId: null,
    }
    linesResult = [{
      id: 100, productId: 1, quantity: -3, oldStock: 10, newStock: 7,
      reason: 'loss', saleId: null, variation: null,
    }]
    productStockResult = { id: 50, productId: 1, establishmentId: 7, stock: 7, stockByVariation: null, tenantId: 'test-tenant-id' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any

    const res = await handler(
      createMockEvent({
        params: { id: '42' },
        body: { lines: [{ id: 100, quantity: 5 }] }, // saisie en valeur absolue
      }),
    )

    expect(res.success).toBe(true)
    // signe préservé : -3 → -5
    expect(res.changedLines[0]).toMatchObject({ id: 100, oldQuantity: -3, newQuantity: -5 })
    // delta = -5 - (-3) = -2 → newStock = 7 + (-2) = 5
    expect((stockMovementsUpdateCalls[0]?.values as { newStock?: number }).newStock).toBe(5)
  })

  it('skip les lignes sans changement de quantité', async () => {
    movementResult = {
      id: 42, tenantId: 'test-tenant-id', type: 'reception',
      comment: null, supplierId: null, deliveryNoteNumber: null,
      establishmentId: 7, userId: null,
    }
    linesResult = [{
      id: 100, productId: 1, quantity: 5, oldStock: 0, newStock: 5,
      reason: 'reception', saleId: null, variation: null,
    }]
    productStockResult = { id: 50, productId: 1, establishmentId: 7, stock: 5, stockByVariation: null, tenantId: 'test-tenant-id' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].put')).default as any

    const res = await handler(
      createMockEvent({
        params: { id: '42' },
        body: { lines: [{ id: 100, quantity: 5 }] },
      }),
    )

    expect(res.success).toBe(true)
    expect(res.changedLines).toHaveLength(0)
    expect(productUpdateCalls).toHaveLength(0)
    expect(productStocksUpdateCalls).toHaveLength(0)
    expect(stockMovementsUpdateCalls).toHaveLength(0)
  })
})
