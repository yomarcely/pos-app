import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from './setup'

// ===========================================
// Mocks des utilitaires serveur (AVANT les imports dynamiques)
// ===========================================

// Mock du tenant - retourne un tenant de test par défaut
vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id')
}))

// Mock du logger pour éviter les logs pendant les tests
vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// ===========================================
// Mocks de base de données
// ===========================================

interface MockDbChain {
  select: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
  leftJoin: ReturnType<typeof vi.fn>
  innerJoin: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  groupBy: ReturnType<typeof vi.fn>
  having: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  offset: ReturnType<typeof vi.fn>
}

let currentDb: MockDbChain

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb }
}))

// Stubs Drizzle ORM
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

// Stubs schema
vi.mock('~/server/database/schema', () => ({
  products: { id: 'products.id', name: 'products.name', tenantId: 'products.tenantId' },
  productEstablishments: { productId: 'pe.productId', establishmentId: 'pe.establishmentId' },
  productStocks: { productId: 'ps.productId', establishmentId: 'ps.establishmentId' },
  categories: { id: 'categories.id', name: 'categories.name' },
  brands: { id: 'brands.id', name: 'brands.name' },
  suppliers: { id: 'suppliers.id', name: 'suppliers.name' },
  variationGroups: { id: 'vg.id', name: 'vg.name', tenantId: 'vg.tenantId' },
  variations: { id: 'v.id', name: 'v.name', groupId: 'v.groupId' }
}))

// ===========================================
// Helpers pour créer des mocks DB
// ===========================================

function createDbForProducts(rows: unknown[]) {
  const chain: MockDbChain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve(rows)),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain)
  }
  return chain
}

function createDbSequence(results: unknown[][]) {
  let index = 0
  const chain: MockDbChain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(results[index++] ?? [])),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve(results[index - 1] ?? [])),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain)
  }
  return chain
}

// ===========================================
// Tests
// ===========================================

describe('API handlers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('products/index.get', () => {
    it('formate les produits et applique les filtres de base', async () => {
      const mockRows = [{
        id: 1,
        name: 'Test Product',
        barcode: '123456789',
        barcodeByVariation: null,
        categoryId: 10,
        categoryName: 'Category A',
        supplierId: 2,
        supplierName: 'Supplier X',
        brandId: 3,
        brandName: 'Brand Y',
        price: '9.99',
        purchasePrice: '5.50',
        tva: '20',
        stock: 4,
        minStock: 1,
        stockByVariation: null,
        minStockByVariation: null,
        variationGroupIds: null,
        image: null,
        description: 'A test product',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      currentDb = createDbForProducts(mockRows)
      const handler = (await import('~/server/api/products/index.get')).default
      const event = createMockEvent({ query: { search: 'Test' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.count).toBe(1)
      expect(res.products[0]).toMatchObject({
        id: 1,
        name: 'Test Product',
        barcode: '123456789',
        price: 9.99,
        purchasePrice: 5.5,
        tva: 20,
        minStock: 1,
        categoryId: 10,
        supplierName: 'Supplier X',
        brandName: 'Brand Y'
      })
    })

    it('retourne une liste vide si aucun produit', async () => {
      currentDb = createDbForProducts([])
      const handler = (await import('~/server/api/products/index.get')).default
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.count).toBe(0)
      expect(res.products).toEqual([])
    })

    it('filtre par establishmentId si fourni', async () => {
      currentDb = createDbForProducts([])
      const handler = (await import('~/server/api/products/index.get')).default
      const event = createMockEvent({ query: { establishmentId: '123' } })

      await handler(event)

      // Vérifie que innerJoin a été appelé (pour le filtre établissement)
      expect(currentDb.innerJoin).toHaveBeenCalled()
    })
  })

  describe('variations/index.get', () => {
    it('retourne les groupes avec variations triées par sortOrder', async () => {
      const groups = [
        { id: 1, name: 'Couleur', tenantId: 'test-tenant-id' },
        { id: 2, name: 'Taille', tenantId: 'test-tenant-id' }
      ]
      const variations = [
        { id: 10, name: 'Rouge', groupId: 1, sortOrder: 2, tenantId: 'test-tenant-id', isArchived: false },
        { id: 11, name: 'Bleu', groupId: 1, sortOrder: 1, tenantId: 'test-tenant-id', isArchived: false },
        { id: 20, name: 'S', groupId: 2, sortOrder: 1, tenantId: 'test-tenant-id', isArchived: false }
      ]

      currentDb = createDbSequence([groups, variations])
      const handler = (await import('~/server/api/variations/index.get')).default
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.groups).toHaveLength(2)

      // Vérifie le tri par sortOrder
      const colorGroup = res.groups.find((g: { id: number }) => g.id === 1)
      expect(colorGroup?.variations.map((v: { id: number }) => v.id)).toEqual([11, 10]) // Bleu (1) avant Rouge (2)
    })

    it('retourne une liste vide si aucun groupe', async () => {
      currentDb = createDbSequence([[], []])
      const handler = (await import('~/server/api/variations/index.get')).default
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.groups).toEqual([])
    })
  })
})
