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

vi.mock('~/server/validators/seller.schema', () => ({
  createSellerSchema: {},
  updateSellerSchema: {},
  CreateSellerInput: {},
  UpdateSellerInput: {}
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
  sellers: {
    id: 'sellers.id', name: 'sellers.name', code: 'sellers.code',
    tenantId: 'sellers.tenantId', isActive: 'sellers.isActive',
    createdAt: 'sellers.createdAt', updatedAt: 'sellers.updatedAt',
  },
  sellerEstablishments: {
    id: 'se.id', sellerId: 'se.sellerId',
    establishmentId: 'se.establishmentId', tenantId: 'se.tenantId',
  },
  establishments: {
    id: 'establishments.id', name: 'establishments.name',
    address: 'establishments.address', city: 'establishments.city',
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

function createInsertChain(newItem: unknown) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newItem])),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
  }
}

function createSelectAndUpdateChain(existingRows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(existingRows).then(resolve, reject),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(existingRows)),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject)
        }))
      }))
    })),
  }
  return chain
}

/**
 * For seller update: update().set().where().returning() + delete().where() + insert().values()
 */
function createSellerUpdateChain(updatedSeller: unknown | null) {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(updatedSeller ? [updatedSeller] : [])),
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
        returning: vi.fn(() => Promise.resolve([])),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(undefined).then(resolve, reject)
      }))
    })),
  }
}

// ===========================================
// Tests
// ===========================================

describe('API /api/sellers', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/sellers
  // -----------------------------------------
  describe('GET /api/sellers', () => {
    it('retourne la liste des vendeurs actifs', async () => {
      const mockSellers = [
        { id: 1, name: 'Alice', code: 'A01', isActive: true },
        { id: 2, name: 'Bob', code: 'B01', isActive: true }
      ]
      currentDb = createReadChain(mockSellers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.sellers).toHaveLength(2)
      expect(res.sellers[0]).toMatchObject({ id: 1, name: 'Alice' })
    })

    it('filtre par establishmentId via innerJoin', async () => {
      const mockSellers = [{ id: 1, name: 'Alice' }]
      currentDb = createReadChain(mockSellers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '10' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.sellers).toHaveLength(1)
      expect(currentDb.innerJoin).toHaveBeenCalled()
    })
  })

  // -----------------------------------------
  // POST /api/sellers/create
  // -----------------------------------------
  describe('POST /api/sellers/create', () => {
    it('crée un vendeur et lie aux établissements', async () => {
      const newSeller = { id: 1, name: 'Alice', code: 'A01', isActive: true }
      currentDb = createInsertChain(newSeller)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Alice', code: 'A01', establishmentIds: [10, 20] }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Vendeur créé avec succès')
      expect(res.seller).toMatchObject({ id: 1, name: 'Alice' })
      // insert called twice: sellers + sellerEstablishments
      expect(currentDb.insert).toHaveBeenCalledTimes(2)
    })

    it('crée un vendeur sans établissements', async () => {
      const newSeller = { id: 1, name: 'Bob', isActive: true }
      currentDb = createInsertChain(newSeller)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Bob' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      // insert called once: only sellers (no establishmentIds)
      expect(currentDb.insert).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------
  // DELETE /api/sellers/:id/delete
  // -----------------------------------------
  describe('DELETE /api/sellers/:id', () => {
    it('désactive le vendeur (soft delete)', async () => {
      currentDb = createSelectAndUpdateChain([{ id: 1, name: 'Alice' }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Vendeur désactivé avec succès')
    })

    it('throw 400 si ID invalide (remonte en 500)', async () => {
      currentDb = createSelectAndUpdateChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: 'abc' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'ID de vendeur invalide'
      })
    })

    it('throw 404 si vendeur introuvable (remonte en 500)', async () => {
      currentDb = createSelectAndUpdateChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Vendeur introuvable'
      })
    })
  })

  // -----------------------------------------
  // PATCH /api/sellers/:id/update
  // -----------------------------------------
  describe('PATCH /api/sellers/:id/update', () => {
    it('met à jour le vendeur et ses établissements', async () => {
      const updated = { id: 1, name: 'Alice Updated', code: 'A02', isActive: true }
      currentDb = createSellerUpdateChain(updated)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { name: 'Alice Updated', code: 'A02', establishmentIds: [10, 30] }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.seller).toMatchObject({ name: 'Alice Updated' })
      // delete old + insert new establishment assignments
      expect(currentDb.delete).toHaveBeenCalled()
      expect(currentDb.insert).toHaveBeenCalled()
    })

    it('throw 404 si vendeur introuvable (remonte en 500)', async () => {
      currentDb = createSellerUpdateChain(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Vendeur introuvable'
      })
    })
  })

  // -----------------------------------------
  // GET /api/sellers/:id/establishments
  // -----------------------------------------
  describe('GET /api/sellers/:id/establishments', () => {
    it('retourne les établissements du vendeur', async () => {
      const mockEstabs = [
        { id: 10, name: 'Boutique Paris', address: '1 rue de Paris', city: 'Paris' },
        { id: 20, name: 'Boutique Lyon', address: '2 rue de Lyon', city: 'Lyon' }
      ]
      currentDb = createReadChain(mockEstabs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/[id]/establishments.get')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.establishments).toHaveLength(2)
      expect(res.establishmentIds).toEqual([10, 20])
    })

    it('throw 400 si ID invalide (remonte en 500)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sellers/[id]/establishments.get')).default as any
      const event = createMockEvent({ params: { id: 'abc' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'ID de vendeur invalide'
      })
    })
  })
})
