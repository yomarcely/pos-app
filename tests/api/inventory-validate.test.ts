import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  if (data.data !== undefined) err.data = data.data
  return err
}

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id'),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (_event: unknown) => (_event as { body?: unknown })?.body || {}),
}))

const logCreate = vi.fn(async () => {})
const logUpdate = vi.fn(async () => {})
const logDeactivate = vi.fn(async () => {})
vi.mock('~/server/utils/audit', () => ({
  logEntityCreation: logCreate,
  logEntityUpdate: logUpdate,
  logEntityDeactivation: logDeactivate,
}))

const createMovementMock = vi.fn(async () => ({ id: 999, movementNumber: 'INVENTORY-000999' }))
vi.mock('~/server/utils/createMovement', () => ({ createMovement: createMovementMock }))

// État partagé
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let preparationsRows: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let preparationItemsRows: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let affectedProductsRows: any[] = []

const stockMovementsInserts: unknown[] = []
const productsUpdates: Array<{ values: unknown }> = []
const productStocksUpdates: Array<{ values: unknown }> = []
const preparationsUpdates: Array<{ values: unknown }> = []
const archiveUpdates: Array<{ values: unknown }> = []

vi.mock('~/server/database/connection', () => {
  function resolveFor(table: string | undefined): unknown[] {
    if (table === 'inventoryPreparations') return preparationsRows
    if (table === 'inventoryPreparationItems') return preparationItemsRows
    if (table === 'products') return affectedProductsRows
    if (table === 'productStocks') return [] // jamais utilisé hors tx
    return []
  }

  function buildSelectChain() {
    let currentTable: string | undefined
    const after = () => ({
      innerJoin: vi.fn(() => after()),
      leftJoin: vi.fn(() => after()),
      where: vi.fn(() => {
        const resolve = () => Promise.resolve(resolveFor(currentTable))
        return {
          limit: vi.fn(() => resolve()),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then: (onF: any, onR: any) => resolve().then(onF, onR),
        }
      }),
    })
    return {
      from: vi.fn((table: { _name?: string }) => {
        currentTable = table?._name
        return after()
      }),
    }
  }

  function buildTx() {
    return {
      select: vi.fn(() => buildSelectChain()),
      insert: vi.fn(() => ({
        values: vi.fn((rows: unknown) => {
          const arr = Array.isArray(rows) ? rows : [rows]
          stockMovementsInserts.push(...arr)
          return Promise.resolve()
        }),
      })),
      update: vi.fn((table: { _name?: string }) => ({
        set: vi.fn((values: unknown) => {
          const name = (table as { _name?: string })?._name
          if (name === 'products') {
            // Distinguer archivage vs ajustement par la présence de isArchived
            const v = values as Record<string, unknown>
            if ('isArchived' in v) archiveUpdates.push({ values: v })
            else productsUpdates.push({ values: v })
          } else if (name === 'productStocks') {
            productStocksUpdates.push({ values })
          } else if (name === 'inventoryPreparations') {
            preparationsUpdates.push({ values })
          }
          return { where: vi.fn(() => Promise.resolve()) }
        }),
      })),
    }
  }

  return {
    db: {
      select: vi.fn(() => buildSelectChain()),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(buildTx())),
    },
  }
})

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  sql: (..._args: unknown[]) => ({ type: 'sql' }),
}))

vi.mock('~/server/database/schema', () => ({
  inventoryPreparations: { _name: 'inventoryPreparations', id: 'p.id', tenantId: 'p.tenantId' },
  inventoryPreparationItems: { _name: 'inventoryPreparationItems', id: 'i.id', tenantId: 'i.tenantId', preparationId: 'i.preparationId' },
  products: {
    _name: 'products',
    id: 'pr.id', name: 'pr.name', tenantId: 'pr.tenantId',
    stock: 'pr.stock', stockByVariation: 'pr.stockByVariation',
    isArchived: 'pr.isArchived',
  },
  productStocks: {
    _name: 'productStocks',
    productId: 'ps.productId', establishmentId: 'ps.establishmentId',
    tenantId: 'ps.tenantId', stock: 'ps.stock', stockByVariation: 'ps.stockByVariation',
  },
  stockMovements: { _name: 'stockMovements' },
}))

function reset() {
  preparationsRows = []
  preparationItemsRows = []
  affectedProductsRows = []
  stockMovementsInserts.length = 0
  productsUpdates.length = 0
  productStocksUpdates.length = 0
  preparationsUpdates.length = 0
  archiveUpdates.length = 0
  createMovementMock.mockClear()
  logCreate.mockClear()
  logUpdate.mockClear()
  logDeactivate.mockClear()
}

describe('POST /api/inventory-preparations/validate', () => {
  beforeEach(() => {
    vi.resetModules()
    reset()
  })

  it('refuse si une préparation est déjà validée', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 3, userId: null },
      { id: 2, tenantId: 'test-tenant-id', status: 'validated', preparationNumber: 'B', establishmentId: 3, userId: null },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/validate.post')).default as any
    await expect(
      handler(createMockEvent({ body: { preparationIds: [1, 2] } })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('renvoie 409 si conflit de comptage entre préparations', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 3, userId: null },
      { id: 2, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'B', establishmentId: 3, userId: null },
    ]
    preparationItemsRows = [
      { preparationId: 1, productId: 5, variation: null, countedStock: 10 },
      { preparationId: 2, productId: 5, variation: null, countedStock: 8 },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/validate.post')).default as any
    await expect(
      handler(createMockEvent({ body: { preparationIds: [1, 2] } })),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuse l\'archivage si stock != 0', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 3, userId: null },
    ]
    preparationItemsRows = []
    affectedProductsRows = [
      { id: 7, name: 'Produit X', stock: 5, stockByVariation: null },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/validate.post')).default as any

    let thrown: unknown
    try {
      await handler(createMockEvent({ body: { preparationIds: [1], archiveProductIds: [7] } }))
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeDefined()
    const err = thrown as { statusCode?: number; data?: { archiveErrors?: unknown[] } }
    expect(err.statusCode).toBe(409)
    expect(err.data?.archiveErrors).toHaveLength(1)
  })

  it('applique le delta sur le stock courant (concurrence ventes)', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 3, userId: null },
    ]
    preparationItemsRows = [
      // L'utilisateur a compté 8 alors qu'au moment de la préparation il pensait avoir 10
      { preparationId: 1, productId: 5, variation: null, countedStock: 8 },
    ]
    // Mais au moment de la validation finale, stock courant est 7 (vente entre temps)
    affectedProductsRows = [
      { id: 5, name: 'Produit A', stock: 7, stockByVariation: null },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/validate.post')).default as any

    const res = await handler(createMockEvent({ body: { preparationIds: [1] } }))

    expect(res.success).toBe(true)
    expect(res.adjustmentCount).toBe(1)
    // delta = compté(8) - courant(7) = +1
    expect(stockMovementsInserts).toHaveLength(1)
    const inserted = stockMovementsInserts[0] as { quantity: number; oldStock: number; newStock: number }
    expect(inserted.quantity).toBe(1)
    expect(inserted.oldStock).toBe(7)
    expect(inserted.newStock).toBe(8)
    expect(createMovementMock).toHaveBeenCalledWith(
      'inventory',
      expect.any(String),
      undefined,
      'test-tenant-id',
      expect.objectContaining({ establishmentId: 3 }),
    )
  })

  it('skip les ajustements où delta = 0', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 3, userId: null },
    ]
    preparationItemsRows = [
      { preparationId: 1, productId: 5, variation: null, countedStock: 10 },
    ]
    affectedProductsRows = [
      { id: 5, name: 'Produit A', stock: 10, stockByVariation: null },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/validate.post')).default as any

    const res = await handler(createMockEvent({ body: { preparationIds: [1] } }))

    expect(res.success).toBe(true)
    expect(res.adjustmentCount).toBe(0)
    expect(stockMovementsInserts).toHaveLength(0)
    // Le mouvement parent est quand même créé
    expect(createMovementMock).toHaveBeenCalled()
  })

  it('applique les mises à zéro et marque les préparations comme validées', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 3, userId: null },
    ]
    preparationItemsRows = []
    affectedProductsRows = [
      { id: 9, name: 'Produit Zero', stock: 3, stockByVariation: null },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/validate.post')).default as any

    const res = await handler(
      createMockEvent({
        body: {
          preparationIds: [1],
          setToZeroItems: [{ productId: 9 }],
        },
      }),
    )

    expect(res.success).toBe(true)
    expect(stockMovementsInserts).toHaveLength(1)
    const inserted = stockMovementsInserts[0] as { quantity: number; newStock: number }
    expect(inserted.quantity).toBe(-3)
    expect(inserted.newStock).toBe(0)
    expect(preparationsUpdates).toHaveLength(1)
    const v = preparationsUpdates[0]!.values as { status?: string; validatedMovementId?: number }
    expect(v.status).toBe('validated')
    expect(v.validatedMovementId).toBe(999)
  })

  it('archive les produits dont le stock est exactement 0', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 3, userId: null },
    ]
    preparationItemsRows = []
    affectedProductsRows = [
      { id: 11, name: 'A archiver', stock: 0, stockByVariation: null },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/validate.post')).default as any

    const res = await handler(
      createMockEvent({
        body: { preparationIds: [1], archiveProductIds: [11] },
      }),
    )

    expect(res.success).toBe(true)
    expect(res.archivedCount).toBe(1)
    expect(archiveUpdates).toHaveLength(1)
    const v = archiveUpdates[0]!.values as { isArchived?: boolean }
    expect(v.isArchived).toBe(true)
    expect(logDeactivate).toHaveBeenCalled()
  })

  it("refuse si un setToZeroItem est aussi inventorié", async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 3, userId: null },
    ]
    preparationItemsRows = [
      { preparationId: 1, productId: 5, variation: null, countedStock: 10 },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/validate.post')).default as any
    await expect(
      handler(
        createMockEvent({
          body: { preparationIds: [1], setToZeroItems: [{ productId: 5 }] },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
