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

const logCreate = vi.fn(async () => {})
const logUpdate = vi.fn(async () => {})
const logDelete = vi.fn(async () => {})
vi.mock('~/server/utils/audit', () => ({
  logEntityCreation: logCreate,
  logEntityUpdate: logUpdate,
  logEntityDeletion: logDelete,
}))

const createPrepMock = vi.fn(async () => ({ id: 7, preparationNumber: 'PREP-INV-000007' }))
vi.mock('~/server/utils/createInventoryPreparation', () => ({
  createInventoryPreparation: createPrepMock,
}))

// État partagé pour piloter le mock DB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let productRows: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prepRow: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let existingItems: any[] = []
const insertedItems: unknown[] = []
const updatedPreps: Array<{ values: unknown }> = []
const updatedItems: Array<{ values: unknown }> = []
const deletedPreps: number[] = []

vi.mock('~/server/database/connection', () => {
  function resolveFor(table: string | undefined): unknown[] {
    if (table === 'products') return productRows
    if (table === 'inventoryPreparations') return prepRow ? [prepRow] : []
    if (table === 'inventoryPreparationItems') return existingItems
    return []
  }

  // Renvoie un thenable qui est aussi chainable .limit() — couvre tous les patterns
  // db.select().from(X).where(...).limit(1)  OU  db.select().from(X).where(...)
  // db.select().from(X).innerJoin(Y, ...).where(...) — innerJoin est ignoré (passthrough)
  function buildSelect() {
    let currentTable: string | undefined
    const buildAfterFrom = () => ({
      innerJoin: vi.fn(() => buildAfterFrom()),
      leftJoin: vi.fn(() => buildAfterFrom()),
      where: vi.fn(() => {
        const resolve = () => Promise.resolve(resolveFor(currentTable))
        const chain = {
          limit: vi.fn(() => resolve()),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then: (onFulfilled: any, onRejected: any) => resolve().then(onFulfilled, onRejected),
          catch: (onRejected: unknown) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            resolve().catch(onRejected as any),
        }
        return chain
      }),
    })
    return {
      from: vi.fn((table: { _name?: string }) => {
        currentTable = table?._name
        return buildAfterFrom()
      }),
    }
  }

  function buildTx() {
    return {
      insert: vi.fn(() => ({
        values: vi.fn((rows: unknown) => ({
          returning: vi.fn(() => {
            const arr = Array.isArray(rows) ? rows : [rows]
            insertedItems.push(...arr)
            return Promise.resolve(arr.map((r, i) => ({ ...(r as object), id: 100 + i })))
          }),
        })),
      })),
      update: vi.fn((table: { _name?: string }) => ({
        set: vi.fn((values: unknown) => {
          if (table?._name === 'inventoryPreparations') updatedPreps.push({ values })
          else if (table?._name === 'inventoryPreparationItems') updatedItems.push({ values })
          return { where: vi.fn(() => Promise.resolve()) }
        }),
      })),
    }
  }

  return {
    db: {
      select: vi.fn(() => buildSelect()),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(buildTx())),
      delete: vi.fn(() => ({
        where: vi.fn(() => {
          deletedPreps.push(1)
          return Promise.resolve()
        }),
      })),
    },
  }
})

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  desc: (col: unknown) => ({ type: 'desc', col }),
  sql: (..._args: unknown[]) => ({ type: 'sql' }),
}))

vi.mock('~/server/database/schema', () => ({
  inventoryPreparations: {
    _name: 'inventoryPreparations',
    id: 'inventoryPreparations.id',
    tenantId: 'inventoryPreparations.tenantId',
    status: 'inventoryPreparations.status',
    establishmentId: 'inventoryPreparations.establishmentId',
  },
  inventoryPreparationItems: {
    _name: 'inventoryPreparationItems',
    id: 'inventoryPreparationItems.id',
    preparationId: 'inventoryPreparationItems.preparationId',
    productId: 'inventoryPreparationItems.productId',
    tenantId: 'inventoryPreparationItems.tenantId',
  },
  products: {
    _name: 'products',
    id: 'products.id', name: 'products.name',
    stock: 'products.stock', stockByVariation: 'products.stockByVariation',
    tenantId: 'products.tenantId',
  },
  productStocks: {
    _name: 'productStocks',
    productId: 'productStocks.productId',
    establishmentId: 'productStocks.establishmentId',
    tenantId: 'productStocks.tenantId',
    stock: 'productStocks.stock',
    stockByVariation: 'productStocks.stockByVariation',
  },
  establishments: { _name: 'establishments', id: 'establishments.id' },
}))

function resetAll() {
  productRows = []
  prepRow = null
  existingItems = []
  insertedItems.length = 0
  updatedPreps.length = 0
  updatedItems.length = 0
  deletedPreps.length = 0
  logCreate.mockClear()
  logUpdate.mockClear()
  logDelete.mockClear()
  createPrepMock.mockClear()
}

// ===========================================
// POST /api/inventory-preparations
// ===========================================
describe('POST /api/inventory-preparations', () => {
  beforeEach(() => {
    vi.resetModules()
    resetAll()
  })

  it('crée la préparation avec expectedStock figé au stock courant', async () => {
    productRows = [
      { id: 1, stock: 12, stockByVariation: null },
      { id: 2, stock: 0, stockByVariation: { 'S': 5, 'M': 3 } },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/index.post')).default as any

    const res = await handler(
      createMockEvent({
        body: {
          name: 'Inventaire chaussures',
          establishmentId: 1,
          items: [
            { productId: 1, countedStock: 10 },
            { productId: 2, variation: 'S', countedStock: 4 },
          ],
        },
      }),
    )

    expect(res.success).toBe(true)
    expect(res.preparation.preparationNumber).toBe('PREP-INV-000007')
    expect(res.itemCount).toBe(2)
    expect(createPrepMock).toHaveBeenCalledWith(
      'test-tenant-id',
      expect.objectContaining({ name: 'Inventaire chaussures', establishmentId: 1 }),
      expect.anything(), // tx — deadlock pooler max=1 sinon (cf. DbExecutor)
    )
    // expectedStock figé : 12 pour produit 1, 5 pour produit 2 variation S
    const inserted = insertedItems as Array<{ expectedStock: number; countedStock: number; variation: string | null }>
    expect(inserted[0]).toMatchObject({ expectedStock: 12, countedStock: 10, variation: null })
    expect(inserted[1]).toMatchObject({ expectedStock: 5, countedStock: 4, variation: 'S' })
    expect(logCreate).toHaveBeenCalled()
  })

  it('renvoie 404 si un produit est introuvable', async () => {
    productRows = [{ id: 1, stock: 12, stockByVariation: null }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/index.post')).default as any

    await expect(
      handler(
        createMockEvent({
          body: {
            items: [
              { productId: 1, countedStock: 10 },
              { productId: 999, countedStock: 1 },
            ],
          },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ===========================================
// PUT /api/inventory-preparations/:id
// ===========================================
describe('PUT /api/inventory-preparations/:id', () => {
  beforeEach(() => {
    vi.resetModules()
    resetAll()
  })

  it('refuse l\'édition d\'une préparation validée', async () => {
    prepRow = { id: 7, tenantId: 'test-tenant-id', status: 'validated', userId: null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/[id].put')).default as any
    await expect(
      handler(createMockEvent({ params: { id: '7' }, body: { name: 'x' } })),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('met à jour le commentaire et les countedStock', async () => {
    prepRow = { id: 7, tenantId: 'test-tenant-id', status: 'draft', userId: null, name: 'old', comment: 'old' }
    existingItems = [{ id: 100 }, { id: 101 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/[id].put')).default as any

    const res = await handler(
      createMockEvent({
        params: { id: '7' },
        body: {
          comment: 'new',
          lines: [
            { id: 100, countedStock: 5 },
            { id: 101, countedStock: 9 },
          ],
        },
      }),
    )

    expect(res.success).toBe(true)
    expect(updatedPreps.length).toBe(1)
    expect((updatedPreps[0]?.values as { comment?: string }).comment).toBe('new')
    expect(updatedItems.length).toBe(2)
    expect(logUpdate).toHaveBeenCalled()
  })

  it('refuse une ligne inconnue', async () => {
    prepRow = { id: 7, tenantId: 'test-tenant-id', status: 'draft', userId: null }
    existingItems = [{ id: 100 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/[id].put')).default as any
    await expect(
      handler(createMockEvent({ params: { id: '7' }, body: { lines: [{ id: 999, countedStock: 3 }] } })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ===========================================
// DELETE /api/inventory-preparations/:id
// ===========================================
describe('DELETE /api/inventory-preparations/:id', () => {
  beforeEach(() => {
    vi.resetModules()
    resetAll()
  })

  it('refuse la suppression d\'une préparation validée', async () => {
    prepRow = { id: 7, tenantId: 'test-tenant-id', status: 'validated', userId: null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/[id].delete')).default as any
    await expect(handler(createMockEvent({ params: { id: '7' } }))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('supprime une préparation draft et log l\'audit', async () => {
    prepRow = {
      id: 7,
      tenantId: 'test-tenant-id',
      status: 'draft',
      userId: null,
      preparationNumber: 'PREP-INV-000007',
      name: 'Test',
      establishmentId: 1,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/[id].delete')).default as any

    const res = await handler(createMockEvent({ params: { id: '7' } }))

    expect(res.success).toBe(true)
    expect(deletedPreps.length).toBe(1)
    expect(logDelete).toHaveBeenCalled()
  })

  it('renvoie 404 si introuvable', async () => {
    prepRow = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/[id].delete')).default as any
    await expect(handler(createMockEvent({ params: { id: '7' } }))).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
