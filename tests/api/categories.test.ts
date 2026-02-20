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

vi.mock('~/server/validators/category.schema', () => ({
  createCategorySchema: {},
  updateCategorySchema: {},
  CreateCategoryInput: {},
  UpdateCategoryInput: {}
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
  like: (...args: unknown[]) => ({ type: 'like', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args })
}))

vi.mock('~/server/database/schema', () => ({
  categories: {
    id: 'categories.id', name: 'categories.name', parentId: 'categories.parentId',
    tenantId: 'categories.tenantId', isArchived: 'categories.isArchived',
    archivedAt: 'categories.archivedAt', updatedAt: 'categories.updatedAt',
    createdByEstablishmentId: 'categories.createdByEstablishmentId',
    sortOrder: 'categories.sortOrder', icon: 'categories.icon', color: 'categories.color',
    $inferSelect: {},
  },
  products: {
    id: 'products.id', categoryId: 'products.categoryId', tenantId: 'products.tenantId',
  },
  syncGroupEstablishments: {
    id: 'sge.id', syncGroupId: 'sge.syncGroupId',
    establishmentId: 'sge.establishmentId', tenantId: 'sge.tenantId',
  }
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

function createSyncFilterChain(syncGroupIds: unknown[], groupEstablishments: unknown[], resultRows: unknown[]) {
  const results = syncGroupIds.length > 0
    ? [syncGroupIds, groupEstablishments, resultRows]
    : [syncGroupIds, resultRows]
  let callIdx = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => { callIdx++; return chain }),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(results[callIdx - 1] || []).then(resolve, reject),
  }
  return chain
}

function createInsertChain(newItem: unknown) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newItem]))
      }))
    })),
  }
}

/**
 * For category delete: 2 selects (subcategories check, products check) + 1 update
 */
function createDeleteChain(subcategories: unknown[], products: unknown[], updateResult: unknown[]) {
  const selectResults = [subcategories, products]
  let selectIdx = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => { selectIdx++; return chain }),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(selectResults[selectIdx - 1] || []).then(resolve, reject),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(updateResult)),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject)
        }))
      }))
    })),
  }
  return chain
}

function createUpdateReturningChain(result: unknown[]) {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(result)),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject)
        }))
      }))
    })),
  }
}

// ===========================================
// Tests
// ===========================================

describe('API /api/categories', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/categories
  // -----------------------------------------
  describe('GET /api/categories', () => {
    it('retourne l\'arbre de catégories avec success: true', async () => {
      const flatCategories = [
        { id: 1, name: 'Boissons', parentId: null, sortOrder: 0, icon: null, color: null, isArchived: false },
        { id: 2, name: 'Sodas', parentId: 1, sortOrder: 0, icon: null, color: null, isArchived: false },
        { id: 3, name: 'Snacks', parentId: null, sortOrder: 0, icon: null, color: null, isArchived: false },
      ]
      currentDb = createReadChain(flatCategories)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.categories).toHaveLength(2) // 2 roots: Boissons, Snacks
      expect(res.totalCount).toBe(3)
      // Boissons should have Sodas as child
      const boissons = res.categories.find((c: { name: string }) => c.name === 'Boissons')
      expect(boissons.children).toHaveLength(1)
      expect(boissons.children[0].name).toBe('Sodas')
    })

    it('filtre par establishmentId via syncGroups', async () => {
      const flatCategories = [
        { id: 1, name: 'Cat A', parentId: null, sortOrder: 0, icon: null, color: null, isArchived: false },
      ]
      currentDb = createSyncFilterChain(
        [{ syncGroupId: 10 }],
        [{ establishmentId: 5 }],
        flatCategories
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '5' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.totalCount).toBe(1)
    })

    it('inclut les catégories archivées si includeArchived=true', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/index.get')).default as any
      const event = createMockEvent({ query: { includeArchived: 'true' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.categories).toEqual([])
    })
  })

  // -----------------------------------------
  // POST /api/categories/create
  // -----------------------------------------
  describe('POST /api/categories/create', () => {
    it('crée une catégorie et retourne { success, category }', async () => {
      const newCategory = { id: 10, name: 'Boissons', parentId: null, tenantId: 'test-tenant-id' }
      currentDb = createInsertChain(newCategory)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Boissons' },
        query: { establishmentId: '5' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Catégorie créée avec succès')
      expect(res.category).toMatchObject({ id: 10, name: 'Boissons' })
    })

    it('crée une sous-catégorie avec parentId', async () => {
      const newCategory = { id: 11, name: 'Sodas', parentId: 1, tenantId: 'test-tenant-id' }
      currentDb = createInsertChain(newCategory)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Sodas', parentId: 1 }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.category).toMatchObject({ parentId: 1 })
    })
  })

  // -----------------------------------------
  // DELETE /api/categories/:id/delete
  // -----------------------------------------
  describe('DELETE /api/categories/:id', () => {
    it('archive la catégorie (soft delete)', async () => {
      const archived = { id: 1, name: 'Boissons', isArchived: true }
      currentDb = createDeleteChain([], [], [archived])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Catégorie supprimée avec succès')
    })

    it('throw 400 si sous-catégories existent (remonte en 500)', async () => {
      currentDb = createDeleteChain([{ id: 2, parentId: 1 }], [], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Impossible de supprimer une catégorie contenant des sous-catégories'
      })
    })

    it('throw 400 si produits liés existent (remonte en 500)', async () => {
      currentDb = createDeleteChain([], [{ id: 5, categoryId: 1 }], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500
      })
    })

    it('throw 404 si catégorie introuvable (remonte en 500)', async () => {
      currentDb = createDeleteChain([], [], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Catégorie introuvable'
      })
    })

    it('throw 400 si ID invalide (remonte en 500)', async () => {
      currentDb = createDeleteChain([], [], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: 'abc' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'ID de catégorie invalide'
      })
    })
  })

  // -----------------------------------------
  // PATCH /api/categories/:id/update
  // -----------------------------------------
  describe('PATCH /api/categories/:id/update', () => {
    it('met à jour la catégorie', async () => {
      const updated = { id: 1, name: 'Boissons chaudes' }
      currentDb = createUpdateReturningChain([updated])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { name: 'Boissons chaudes' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.category).toMatchObject({ name: 'Boissons chaudes' })
    })

    it('throw 400 si parentId = self (remonte en 500)', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '5' },
        body: { parentId: 5 }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Une catégorie ne peut pas être son propre parent'
      })
    })

    it('throw 404 si catégorie introuvable (remonte en 500)', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/categories/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Catégorie introuvable'
      })
    })
  })
})
