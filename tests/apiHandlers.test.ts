import { describe, it, expect, beforeEach, vi } from 'vitest'

// Globals simulant l'environnement Nuxt/Nitro
;(globalThis as any).defineEventHandler = (fn: any) => fn
;(globalThis as any).createError = (data: any) => ({ __isError: true, ...data })
;(globalThis as any).getQuery = (event: any) => event?.query || {}

// db mock injecté dynamiquement
let currentDb: any
vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb }
}))

// Stubs Drizzle
vi.mock('drizzle-orm', () => ({
  sql: (...args: any[]) => args,
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args })
}))

// Stubs schema (non utilisés dans les mocks)
vi.mock('~/server/database/schema', () => ({
  products: {},
  categories: {},
  brands: {},
  suppliers: {},
  variationGroups: {},
  variations: {}
}))

function createDbForProducts(rows: any[]) {
  return {
    select() {
      const chain = {
        from() { return chain },
        leftJoin() { return chain },
        where() { return chain },
        orderBy: async () => rows
      }
      return chain
    }
  }
}

function createDbSequence(results: any[][]) {
  // Chaque select().from().where() retourne successivement les entrées du tableau
  let index = 0
  return {
    select() {
      return {
        from() {
          return {
            where: async () => results[index++] ?? []
          }
        }
      }
    }
  }
}

describe('API handlers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('products/index.get formate les produits et applique les filtres de base', async () => {
    const mockRows = [{
      id: 1,
      name: 'Test',
      barcode: '123',
      barcodeByVariation: null,
      categoryId: 10,
      categoryName: 'Cat',
      supplierId: 2,
      supplierName: 'Supp',
      brandId: 3,
      brandName: 'Brand',
      price: '9.99',
      purchasePrice: '5.50',
      tva: '20',
      stock: 4,
      minStock: 1,
      stockByVariation: null,
      minStockByVariation: null,
      variationGroupIds: null,
      image: null,
      description: 'desc',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }]

    currentDb = createDbForProducts(mockRows)
    const handler = (await import('@/server/api/products/index.get')).default

    const res = await handler({ query: { search: 'Test' } } as any)
    expect(res.success).toBe(true)
    expect(res.count).toBe(1)
    expect(res.products[0]).toMatchObject({
      id: 1,
      name: 'Test',
      barcode: '123',
      price: 9.99,
      purchasePrice: 5.5,
      tva: 20,
      minStock: 1,
      categoryId: 10,
      supplierName: 'Supp',
      brandName: 'Brand'
    })
  })

  it('variations/index.get retourne les groupes avec variations triées', async () => {
    const groups = [
      { id: 1, name: 'Couleur' },
      { id: 2, name: 'Taille' }
    ]
    const vars = [
      { id: 10, name: 'Rouge', groupId: 1, sortOrder: 2 },
      { id: 11, name: 'Bleu', groupId: 1, sortOrder: 1 },
      { id: 20, name: 'S', groupId: 2, sortOrder: 1 }
    ]

    currentDb = createDbSequence([groups, vars])
    const handler = (await import('@/server/api/variations/index.get')).default

    const res = await handler({} as any)
    expect(res.success).toBe(true)
    expect(res.groups).toHaveLength(2)
    const color = res.groups.find((g: any) => g.id === 1)
    expect(color?.variations.map((v: any) => v.id)).toEqual([11, 10]) // tri sortOrder
  })
})
