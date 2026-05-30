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

const logEntityDeletionMock = vi.fn(async () => {})
vi.mock('~/server/utils/audit', () => ({
  logEntityDeletion: logEntityDeletionMock,
}))

// État partagé pour piloter les retours du mock DB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let movementResult: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let linesResult: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let productResult: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let productStockResult: any = null

// Compteur pour différencier les requêtes au niveau db.select() (hors transaction)
let dbSelectCallIndex = 0
const productUpdateCalls: Array<{ values: unknown }> = []
const productStocksUpdateCalls: Array<{ values: unknown }> = []
const deleteCalls: Array<{ where: unknown }> = []

vi.mock('~/server/database/connection', () => {
  function buildTxChain() {
    const tx = {
      // Discriminer par la table passée à from() pour renvoyer le bon résultat
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
          if ((table as { _name?: string })?._name === 'products') {
            productUpdateCalls.push({ values })
          } else {
            productStocksUpdateCalls.push({ values })
          }
          return {
            where: vi.fn(() => Promise.resolve()),
          }
        }),
      })),
      delete: vi.fn(() => ({
        where: vi.fn((cond: unknown) => {
          deleteCalls.push({ where: cond })
          return Promise.resolve()
        }),
      })),
    }
    return tx
  }

  return {
    db: {
      select: vi.fn(() => {
        dbSelectCallIndex++
        // Premier select : movement principal (limit 1)
        // Deuxième select : lignes (sans limit)
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
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(buildTxChain())
      }),
    },
  }
})

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  sql: (...args: unknown[]) => ({ type: 'sql', args }),
}))

vi.mock('~/server/database/schema', () => ({
  movements: { _name: 'movements', id: 'movements.id', tenantId: 'movements.tenantId' },
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
  deleteCalls.length = 0
  logEntityDeletionMock.mockClear()
}

describe('DELETE /api/movements/:id', () => {
  beforeEach(() => {
    vi.resetModules()
    resetState()
  })

  it('renvoie 400 si l\'ID est manquant', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].delete')).default as any
    await expect(handler(createMockEvent({ params: {} }))).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('renvoie 404 si le mouvement est introuvable', async () => {
    movementResult = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].delete')).default as any
    await expect(handler(createMockEvent({ params: { id: '42' } }))).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('refuse la suppression si une ligne provient d\'une vente', async () => {
    movementResult = { id: 42, tenantId: 'test-tenant-id', type: 'reception' }
    linesResult = [{ id: 1, productId: 1, quantity: 5, reason: 'sale', saleId: 99 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].delete')).default as any
    await expect(handler(createMockEvent({ params: { id: '42' } }))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('supprime un mouvement sans lignes et log l\'audit', async () => {
    movementResult = {
      id: 42,
      tenantId: 'test-tenant-id',
      movementNumber: 'REC-000042',
      type: 'reception',
      comment: 'Test',
      supplierId: null,
      deliveryNoteNumber: null,
      establishmentId: null,
      userId: null,
    }
    linesResult = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].delete')).default as any

    const res = await handler(createMockEvent({ params: { id: '42' } }))

    expect(res.success).toBe(true)
    expect(res.movementId).toBe(42)
    expect(res.lineCount).toBe(0)
    expect(deleteCalls).toHaveLength(1)
    expect(logEntityDeletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'movement',
        entityId: 42,
      }),
    )
  })

  it('revert le stock global du produit pour chaque ligne', async () => {
    movementResult = {
      id: 42,
      tenantId: 'test-tenant-id',
      movementNumber: 'REC-000042',
      type: 'reception',
      comment: null,
      supplierId: null,
      deliveryNoteNumber: null,
      establishmentId: null,
      userId: null,
    }
    linesResult = [
      { id: 100, productId: 1, variation: null, quantity: 5, oldStock: 10, newStock: 15, reason: 'reception', saleId: null },
      { id: 101, productId: 2, variation: null, quantity: 3, oldStock: 0, newStock: 3, reason: 'reception', saleId: null },
    ]
    productResult = { id: 1, name: 'Produit', stock: 15, stockByVariation: null, tenantId: 'test-tenant-id' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].delete')).default as any

    const res = await handler(createMockEvent({ params: { id: '42' } }))

    expect(res.success).toBe(true)
    expect(res.lineCount).toBe(2)
    expect(productUpdateCalls.length).toBe(2)
  })

  it('revert également productStocks si le mouvement a un establishmentId', async () => {
    movementResult = {
      id: 42,
      tenantId: 'test-tenant-id',
      movementNumber: 'REC-000042',
      type: 'reception',
      comment: null,
      supplierId: null,
      deliveryNoteNumber: null,
      establishmentId: 7,
      userId: null,
    }
    linesResult = [
      { id: 100, productId: 1, variation: null, quantity: 5, oldStock: 10, newStock: 15, reason: 'reception', saleId: null },
    ]
    productResult = { id: 1, name: 'Produit', stock: 15, stockByVariation: null, tenantId: 'test-tenant-id' }
    productStockResult = { id: 999, productId: 1, establishmentId: 7, stock: 15, stockByVariation: null, tenantId: 'test-tenant-id' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/[id].delete')).default as any

    const res = await handler(createMockEvent({ params: { id: '42' } }))

    expect(res.success).toBe(true)
    expect(productUpdateCalls.length).toBe(1)
    expect(productStocksUpdateCalls.length).toBe(1)
  })
})
