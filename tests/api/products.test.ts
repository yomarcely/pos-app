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

vi.mock('~/server/validators/product.schema', () => ({
  createProductSchema: {},
  updateProductSchema: {},
  updateStockSchema: {},
  CreateProductInput: {},
  UpdateProductInput: {},
  UpdateStockInput: {}
}))

vi.mock('~/server/utils/sync', () => ({
  syncProductToGroup: vi.fn(() => Promise.resolve()),
  getGlobalProductFields: vi.fn((_tenantId: string, _estId: number, data: unknown) => data),
}))

vi.mock('h3', () => ({
  getRequestIP: vi.fn(() => '127.0.0.1'),
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
  or: (...args: unknown[]) => ({ type: 'or', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  ne: (...args: unknown[]) => ({ type: 'ne', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}))

vi.mock('~/server/database/schema', () => ({
  products: {
    id: 'products.id', name: 'products.name', barcode: 'products.barcode',
    barcodeByVariation: 'products.barcodeByVariation',
    categoryId: 'products.categoryId', supplierId: 'products.supplierId',
    brandId: 'products.brandId', price: 'products.price',
    purchasePrice: 'products.purchasePrice', tva: 'products.tva',
    tvaId: 'products.tvaId', stock: 'products.stock',
    minStock: 'products.minStock', stockByVariation: 'products.stockByVariation',
    minStockByVariation: 'products.minStockByVariation',
    variationGroupIds: 'products.variationGroupIds',
    image: 'products.image', description: 'products.description',
    supplierCode: 'products.supplierCode',
    isArchived: 'products.isArchived', tenantId: 'products.tenantId',
    createdAt: 'products.createdAt', updatedAt: 'products.updatedAt',
  },
  categories: { id: 'categories.id', name: 'categories.name' },
  brands: { id: 'brands.id', name: 'brands.name' },
  suppliers: { id: 'suppliers.id', name: 'suppliers.name' },
  productStocks: {
    productId: 'ps.productId', establishmentId: 'ps.establishmentId',
    tenantId: 'ps.tenantId', stock: 'ps.stock',
    stockByVariation: 'ps.stockByVariation',
    minStock: 'ps.minStock', minStockByVariation: 'ps.minStockByVariation',
  },
  productEstablishments: {
    id: 'pe.id', productId: 'pe.productId',
    establishmentId: 'pe.establishmentId', tenantId: 'pe.tenantId',
    priceOverride: 'pe.priceOverride', purchasePriceOverride: 'pe.purchasePriceOverride',
    nameOverride: 'pe.nameOverride', descriptionOverride: 'pe.descriptionOverride',
    barcodeOverride: 'pe.barcodeOverride', supplierIdOverride: 'pe.supplierIdOverride',
    categoryIdOverride: 'pe.categoryIdOverride', brandIdOverride: 'pe.brandIdOverride',
    tvaOverride: 'pe.tvaOverride', tvaIdOverride: 'pe.tvaIdOverride',
    imageOverride: 'pe.imageOverride', variationGroupIdsOverride: 'pe.variationGroupIdsOverride',
    isAvailable: 'pe.isAvailable', notes: 'pe.notes',
  },
  stockMovements: {
    id: 'sm.id', productId: 'sm.productId', tenantId: 'sm.tenantId',
    variation: 'sm.variation', quantity: 'sm.quantity',
    oldStock: 'sm.oldStock', newStock: 'sm.newStock',
    reason: 'sm.reason', userId: 'sm.userId',
    createdAt: 'sm.createdAt', saleId: 'sm.saleId', movementId: 'sm.movementId',
  },
  movements: {
    id: 'movements.id', movementNumber: 'movements.movementNumber',
    comment: 'movements.comment',
  },
  sales: { id: 'sales.id', ticketNumber: 'sales.ticketNumber' },
  auditLogs: {
    tenantId: 'al.tenantId', userId: 'al.userId', userName: 'al.userName',
    entityType: 'al.entityType', entityId: 'al.entityId', action: 'al.action',
    changes: 'al.changes', metadata: 'al.metadata', ipAddress: 'al.ipAddress',
  },
  syncRules: {
    id: 'sr.id', syncGroupId: 'sr.syncGroupId', tenantId: 'sr.tenantId',
    entityType: 'sr.entityType', syncPriceTtc: 'sr.syncPriceTtc',
  },
  syncGroups: { id: 'sg.id', tenantId: 'sg.tenantId' },
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
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return chain
}

function createProductCreateChain(newProduct: unknown) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newProduct])),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
  }
}

function createProductUpdateChain(updatedProduct: unknown | null) {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(updatedProduct ? [updatedProduct] : []))
        }))
      }))
    })),
  }
}

/**
 * For product delete: 1 select (existence check) + 1 delete
 */
function createProductDeleteChain(product: unknown | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(() => selectChain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(product ? [product] : []).then(resolve, reject),
  }
  return {
    select: vi.fn(() => selectChain),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
  }
}

/**
 * For stock history: 2 sequential selects (product check + stockMovements)
 */
function createStockHistoryChain(product: unknown | null, movs: unknown[]) {
  let selectIdx = 0
  const results = [product ? [product] : [], movs]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => { selectIdx++; return chain }),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(results[selectIdx - 1] || []).then(resolve, reject),
  }
  return chain
}

/**
 * For stock movement delete: 2 selects + update + delete + insert
 */
function createMovementDeleteChain(movement: unknown | null, product: unknown | null) {
  let selectIdx = 0
  const selectResults = [movement ? [movement] : [], product ? [product] : []]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(() => selectChain),
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
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
  }
}

/**
 * For update stock: transaction with tx having select, update, insert
 */
function createUpdateStockTxChain(product: unknown | null, movementResult: unknown) {
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
        returning: vi.fn(() => Promise.resolve([movementResult])),
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

describe('API /api/products', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/products
  // -----------------------------------------
  describe('GET /api/products', () => {
    it('retourne la liste des produits', async () => {
      const mockProducts = [
        { id: 1, name: 'Produit A', price: '10.00', tva: '20', stock: 5, categoryName: 'Cat 1', supplierName: null, brandName: null, barcode: null, barcodeByVariation: null, categoryId: 1, supplierId: null, brandId: null, purchasePrice: null, minStock: 5, stockByVariation: null, minStockByVariation: null, variationGroupIds: null, image: null, description: null, isArchived: false, createdAt: null, updatedAt: null },
      ]
      currentDb = createReadChain(mockProducts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.products).toHaveLength(1)
      expect(res.count).toBe(1)
      expect(currentDb.leftJoin).toHaveBeenCalledTimes(3)
    })

    it('utilise innerJoin pour filtrer par establishmentId', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '5' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(currentDb.innerJoin).toHaveBeenCalled()
    })
  })

  // -----------------------------------------
  // POST /api/products/create
  // -----------------------------------------
  describe('POST /api/products/create', () => {
    it('crée un produit', async () => {
      const newProduct = { id: 1, name: 'Nouveau produit', price: '15.00', stock: 10 }
      currentDb = createProductCreateChain(newProduct)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Nouveau produit', price: 15, stock: 10 }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.product).toMatchObject({ id: 1, name: 'Nouveau produit' })
    })

    it('crée un produit avec stock pour l\'établissement', async () => {
      const newProduct = { id: 1, name: 'Produit', price: '10.00', stock: 5 }
      currentDb = createProductCreateChain(newProduct)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/create.post')).default as any
      const event = createMockEvent({
        query: { establishmentId: '5' },
        body: { name: 'Produit', price: 10, stock: 5 }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(currentDb.insert).toHaveBeenCalledTimes(2)
    })
  })

  // -----------------------------------------
  // GET /api/products/:id
  // -----------------------------------------
  describe('GET /api/products/:id', () => {
    it('retourne un produit par ID', async () => {
      const product = {
        id: 1, name: 'Produit A', price: '10.00', tva: '20', stock: 5,
        description: 'Desc', barcode: '123', supplierCode: 'SC1',
        categoryId: 1, supplierId: 1, brandId: null, tvaId: null,
        image: null, barcodeByVariation: null, purchasePrice: '5.00',
        variationGroupIds: null, stockByVariation: null, minStockByVariation: null,
        minStock: 5,
        nameOverride: null, descriptionOverride: null, barcodeOverride: null,
        supplierIdOverride: null, categoryIdOverride: null, brandIdOverride: null,
        tvaOverride: null, tvaIdOverride: null, imageOverride: null,
        variationGroupIdsOverride: null, priceOverride: null, purchasePriceOverride: null,
        establishmentId: null, establishmentStock: undefined,
        establishmentStockByVariation: undefined,
        establishmentMinStock: undefined, establishmentMinStockByVariation: undefined,
      }
      currentDb = createReadChain([product])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/[id].get')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.product.id).toBe(1)
      expect(res.product.name).toBe('Produit A')
    })

    it('throw 404 si produit introuvable', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/[id].get')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Produit non trouvé'
      })
    })
  })

  // -----------------------------------------
  // PUT /api/products/:id
  // -----------------------------------------
  describe('PUT /api/products/:id', () => {
    it('met à jour le produit', async () => {
      const updated = { id: 1, name: 'Produit Modifié', price: '20.00' }
      currentDb = createProductUpdateChain(updated)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/[id].put')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { name: 'Produit Modifié' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.product).toMatchObject({ name: 'Produit Modifié' })
    })

    it('throw 404 si produit introuvable', async () => {
      currentDb = createProductUpdateChain(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/[id].put')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Produit non trouvé'
      })
    })
  })

  // -----------------------------------------
  // DELETE /api/products/:id/delete
  // -----------------------------------------
  describe('DELETE /api/products/:id', () => {
    it('supprime le produit (hard delete)', async () => {
      currentDb = createProductDeleteChain({ id: 1, name: 'Produit A' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Produit supprimé avec succès')
      expect(res.product).toMatchObject({ id: 1, name: 'Produit A' })
    })

    it('throw 404 si produit introuvable (remonte en 500)', async () => {
      currentDb = createProductDeleteChain(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Produit non trouvé'
      })
    })
  })

  // -----------------------------------------
  // GET /api/products/:id/stock-history
  // -----------------------------------------
  describe('GET /api/products/:id/stock-history', () => {
    it('retourne l\'historique des mouvements de stock', async () => {
      const product = { id: 1, name: 'Produit A' }
      const movs = [
        { id: 10, productId: 1, variation: null, quantity: 5, oldStock: 0, newStock: 5, reason: 'reception', userId: 1, createdAt: new Date(), saleId: null, movementId: null, movementNumber: null, movementComment: null, saleTicket: null },
      ]
      currentDb = createStockHistoryChain(product, movs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/[id]/stock-history.get')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.movements).toHaveLength(1)
      expect(res.count).toBe(1)
    })

    it('throw 404 si produit introuvable (remonte en 500)', async () => {
      currentDb = createStockHistoryChain(null, [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/[id]/stock-history.get')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Produit non trouvé'
      })
    })
  })

  // -----------------------------------------
  // GET /api/products/stock-movements
  // -----------------------------------------
  describe('GET /api/products/stock-movements', () => {
    it('retourne les mouvements de stock (hors ventes)', async () => {
      const movs = [
        { id: 10, productId: 1, variation: null, quantity: 5, oldStock: 0, newStock: 5, reason: 'reception', saleId: null, userId: 1, createdAt: new Date(), productName: 'Produit A' },
      ]
      currentDb = createReadChain(movs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/stock-movements.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.movements).toHaveLength(1)
      expect(res.movements[0].productName).toBe('Produit A')
    })
  })

  // -----------------------------------------
  // DELETE /api/products/stock-movements/:id
  // -----------------------------------------
  describe('DELETE /api/products/stock-movements/:id', () => {
    it('supprime le mouvement et restaure le stock', async () => {
      const movement = { id: 10, productId: 1, variation: null, quantity: 5, oldStock: 0, newStock: 5, reason: 'reception', userId: 1 }
      const product = { id: 1, name: 'Produit A', stock: 15, stockByVariation: null }
      currentDb = createMovementDeleteChain(movement, product)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/stock-movements/[id].delete')).default as any
      const event = createMockEvent({ params: { id: '10' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Mouvement supprimé et stock restauré')
      expect(res.movement).toMatchObject({ id: 10, productId: 1, quantity: 5 })
    })

    it('throw 403 si mouvement de vente (remonte en 500)', async () => {
      const movement = { id: 10, productId: 1, variation: null, quantity: -2, reason: 'sale', userId: 1 }
      currentDb = createMovementDeleteChain(movement, null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/stock-movements/[id].delete')).default as any
      const event = createMockEvent({ params: { id: '10' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Impossible de supprimer un mouvement de vente. Utilisez l\'annulation de vente.'
      })
    })

    it('throw 404 si mouvement introuvable (remonte en 500)', async () => {
      currentDb = createMovementDeleteChain(null, null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/stock-movements/[id].delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Mouvement non trouvé'
      })
    })
  })

  // -----------------------------------------
  // POST /api/products/update-stock
  // -----------------------------------------
  describe('POST /api/products/update-stock', () => {
    it('met à jour le stock en mode add', async () => {
      const product = { id: 1, name: 'Produit A', stock: 10, stockByVariation: null }
      currentDb = createUpdateStockTxChain(product, { id: 100 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/update-stock.post')).default as any
      const event = createMockEvent({
        body: { productId: 1, quantity: 5, adjustmentType: 'add', reason: 'reception' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.stock.oldStock).toBe(10)
      expect(res.stock.newStock).toBe(15)
      expect(res.stock.delta).toBe(5)
    })

    it('met à jour le stock en mode set', async () => {
      const product = { id: 1, name: 'Produit A', stock: 10, stockByVariation: null }
      currentDb = createUpdateStockTxChain(product, { id: 101 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/update-stock.post')).default as any
      const event = createMockEvent({
        body: { productId: 1, quantity: 20, adjustmentType: 'set', reason: 'inventory_adjustment' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.stock.oldStock).toBe(10)
      expect(res.stock.newStock).toBe(20)
      expect(res.stock.delta).toBe(10)
    })

    it('throw 404 si produit introuvable (remonte en 500)', async () => {
      currentDb = createUpdateStockTxChain(null, {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/products/update-stock.post')).default as any
      const event = createMockEvent({
        body: { productId: 999, quantity: 5, adjustmentType: 'add', reason: 'reception' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Produit non trouvé'
      })
    })
  })
})
