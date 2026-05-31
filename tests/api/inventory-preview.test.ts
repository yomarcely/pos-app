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

// État partagé : 4 ensembles de rows selon la table interrogée
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let preparationsRows: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let preparationItemsRows: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let inventoriedProductsRows: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeProductsRows: any[] = []

let productsSelectCallIndex = 0

vi.mock('~/server/database/connection', () => ({
  db: {
    select: vi.fn(() => {
      let currentTable: string | undefined
      // Le chain ignore innerJoin / leftJoin et résout sur where()
      const buildChain = () => ({
        innerJoin: vi.fn(() => buildChain()),
        leftJoin: vi.fn(() => buildChain()),
        where: vi.fn(() => {
          if (currentTable === 'inventoryPreparations') {
            return Promise.resolve(preparationsRows)
          }
          if (currentTable === 'inventoryPreparationItems') {
            return Promise.resolve(preparationItemsRows)
          }
          if (currentTable === 'products') {
            productsSelectCallIndex++
            // 1er appel sur products → inventoriedProducts (avec stock)
            // 2e appel sur products → activeProducts (tous les actifs)
            if (productsSelectCallIndex === 1) return Promise.resolve(inventoriedProductsRows)
            return Promise.resolve(activeProductsRows)
          }
          return Promise.resolve([])
        }),
      })
      return {
        from: vi.fn((table: { _name?: string }) => {
          currentTable = table?._name
          return buildChain()
        }),
      }
    }),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}))

vi.mock('~/server/database/schema', () => ({
  inventoryPreparations: { _name: 'inventoryPreparations', id: 'p.id', tenantId: 'p.tenantId' },
  inventoryPreparationItems: { _name: 'inventoryPreparationItems', id: 'i.id', tenantId: 'i.tenantId', preparationId: 'i.preparationId' },
  products: {
    _name: 'products',
    id: 'pr.id', name: 'pr.name', stock: 'pr.stock', stockByVariation: 'pr.stockByVariation',
    tenantId: 'pr.tenantId', isArchived: 'pr.isArchived',
  },
  productStocks: {
    _name: 'productStocks',
    productId: 'ps.productId', establishmentId: 'ps.establishmentId',
    tenantId: 'ps.tenantId', stock: 'ps.stock', stockByVariation: 'ps.stockByVariation',
  },
}))

function reset() {
  preparationsRows = []
  preparationItemsRows = []
  inventoriedProductsRows = []
  activeProductsRows = []
  productsSelectCallIndex = 0
}

describe('POST /api/inventory-preparations/preview', () => {
  beforeEach(() => {
    vi.resetModules()
    reset()
  })

  it('renvoie 404 si une préparation est introuvable', async () => {
    preparationsRows = [{ id: 1, tenantId: 'test-tenant-id', status: 'draft' }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/preview.post')).default as any
    await expect(
      handler(createMockEvent({ body: { preparationIds: [1, 999] } })),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('renvoie 400 si une préparation est déjà validée', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'PREP-INV-000001', establishmentId: 1 },
      { id: 2, tenantId: 'test-tenant-id', status: 'validated', preparationNumber: 'PREP-INV-000002', establishmentId: 1 },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/preview.post')).default as any
    await expect(
      handler(createMockEvent({ body: { preparationIds: [1, 2] } })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it("renvoie 400 si les préparations sont sur des établissements différents", async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'A', establishmentId: 1 },
      { id: 2, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'B', establishmentId: 2 },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/preview.post')).default as any
    await expect(
      handler(createMockEvent({ body: { preparationIds: [1, 2] } })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('renvoie 409 + détail des conflits si valeurs divergentes', async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'PREP-A', establishmentId: 1 },
      { id: 2, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'PREP-B', establishmentId: 1 },
    ]
    preparationItemsRows = [
      { id: 10, preparationId: 1, productId: 5, variation: null, expectedStock: 10, countedStock: 8 },
      { id: 11, preparationId: 2, productId: 5, variation: null, expectedStock: 10, countedStock: 7 },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/preview.post')).default as any

    let thrown: unknown
    try {
      await handler(createMockEvent({ body: { preparationIds: [1, 2] } }))
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeDefined()
    const err = thrown as { statusCode?: number; data?: { conflicts?: unknown[] } }
    expect(err.statusCode).toBe(409)
    expect(err.data?.conflicts).toBeDefined()
    expect(err.data?.conflicts).toHaveLength(1)
  })

  it("retourne les 3 tableaux quand pas de conflit", async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'PREP-A', establishmentId: 1 },
    ]
    preparationItemsRows = [
      { id: 10, preparationId: 1, productId: 5, variation: null, expectedStock: 10, countedStock: 8 },
    ]
    inventoriedProductsRows = [
      { id: 5, name: 'Produit A', stock: 10, stockByVariation: null },
    ]
    activeProductsRows = [
      { id: 5, name: 'Produit A', stock: 10, stockByVariation: null, isArchived: false },
      // Produit 6 non inventorié avec stock positif
      { id: 6, name: 'Produit B', stock: 4, stockByVariation: null, isArchived: false },
      // Produit 7 non inventorié avec stock 0 → archivable
      { id: 7, name: 'Produit C', stock: 0, stockByVariation: null, isArchived: false },
      // Produit 8 non inventorié avec stock négatif → non archivable
      { id: 8, name: 'Produit D', stock: -2, stockByVariation: null, isArchived: false },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/preview.post')).default as any

    const res = await handler(createMockEvent({ body: { preparationIds: [1] } }))

    expect(res.success).toBe(true)
    expect(res.inventoried).toHaveLength(1)
    expect(res.inventoried[0]).toMatchObject({
      productId: 5,
      currentStock: 10,
      countedStock: 8,
      delta: -2,
    })
    expect(res.notInventoriedPositive).toHaveLength(1)
    expect(res.notInventoriedPositive[0]).toMatchObject({ productId: 6, stock: 4 })
    expect(res.notInventoriedNonPositive).toHaveLength(2)
    // Produits C (0) et D (-2) triés par nom
    expect(res.notInventoriedNonPositive[0]).toMatchObject({ productId: 7, stock: 0 })
    expect(res.notInventoriedNonPositive[1]).toMatchObject({ productId: 8, stock: -2 })
  })

  it("dispatche les variations dans les bons tableaux", async () => {
    preparationsRows = [
      { id: 1, tenantId: 'test-tenant-id', status: 'draft', preparationNumber: 'PREP-A', establishmentId: 1 },
    ]
    // On compte seulement la variation S du produit 5
    preparationItemsRows = [
      { id: 10, preparationId: 1, productId: 5, variation: 'S', expectedStock: 3, countedStock: 4 },
    ]
    inventoriedProductsRows = [
      { id: 5, name: 'Produit V', stock: 0, stockByVariation: { S: 3, M: 5, L: 0 } },
    ]
    activeProductsRows = [
      { id: 5, name: 'Produit V', stock: 0, stockByVariation: { S: 3, M: 5, L: 0 }, isArchived: false },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/inventory-preparations/preview.post')).default as any

    const res = await handler(createMockEvent({ body: { preparationIds: [1] } }))

    expect(res.inventoried).toHaveLength(1)
    expect(res.inventoried[0]).toMatchObject({ variation: 'S', currentStock: 3, countedStock: 4, delta: 1 })
    // M (stock 5) → tableau positif
    expect(res.notInventoriedPositive.some((r: { variation: string }) => r.variation === 'M')).toBe(true)
    // L (stock 0) → tableau non-positif
    expect(res.notInventoriedNonPositive.some((r: { variation: string }) => r.variation === 'L')).toBe(true)
  })
})
