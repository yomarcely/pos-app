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

vi.mock('~/server/validators/establishment.schema', () => ({
  createEstablishmentSchema: {},
  updateEstablishmentSchema: {},
  CreateEstablishmentInput: {},
  UpdateEstablishmentInput: {}
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
  establishments: {
    id: 'establishments.id', name: 'establishments.name', tenantId: 'establishments.tenantId',
    isActive: 'establishments.isActive', address: 'establishments.address',
    postalCode: 'establishments.postalCode', city: 'establishments.city',
    country: 'establishments.country', phone: 'establishments.phone',
    email: 'establishments.email', siret: 'establishments.siret',
    naf: 'establishments.naf', tvaNumber: 'establishments.tvaNumber',
    createdAt: 'establishments.createdAt', updatedAt: 'establishments.updatedAt',
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
        returning: vi.fn(() => Promise.resolve([newItem]))
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

describe('API /api/establishments', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/establishments
  // -----------------------------------------
  describe('GET /api/establishments', () => {
    it('retourne la liste des établissements actifs', async () => {
      const mockEstabs = [
        { id: 1, name: 'Boutique Paris', city: 'Paris', isActive: true },
        { id: 2, name: 'Boutique Lyon', city: 'Lyon', isActive: true }
      ]
      currentDb = createReadChain(mockEstabs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.establishments).toHaveLength(2)
      expect(res.establishments[0]).toMatchObject({ id: 1, name: 'Boutique Paris' })
    })
  })

  // -----------------------------------------
  // POST /api/establishments/create
  // -----------------------------------------
  describe('POST /api/establishments/create', () => {
    it('crée un établissement', async () => {
      const newEstab = { id: 1, name: 'Boutique Paris', city: 'Paris', country: 'France', isActive: true }
      currentDb = createInsertChain(newEstab)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Boutique Paris', city: 'Paris' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Établissement créé avec succès')
      expect(res.establishment).toMatchObject({ id: 1, name: 'Boutique Paris' })
    })
  })

  // -----------------------------------------
  // GET /api/establishments/:id
  // -----------------------------------------
  describe('GET /api/establishments/:id', () => {
    it('retourne l\'établissement par ID', async () => {
      const estab = { id: 1, name: 'Boutique Paris', city: 'Paris' }
      currentDb = createReadChain([estab])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/[id]/index.get')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.establishment).toMatchObject({ id: 1, name: 'Boutique Paris' })
    })

    it('throw 400 si ID invalide (remonte en 500)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/[id]/index.get')).default as any
      const event = createMockEvent({ params: { id: 'abc' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'ID d\'établissement invalide'
      })
    })

    it('throw 404 si établissement introuvable (remonte en 500)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/[id]/index.get')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Établissement introuvable'
      })
    })
  })

  // -----------------------------------------
  // DELETE /api/establishments/:id/delete
  // -----------------------------------------
  describe('DELETE /api/establishments/:id', () => {
    it('désactive l\'établissement (soft delete)', async () => {
      currentDb = createSelectAndUpdateChain([{ id: 1, name: 'Boutique Paris' }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Établissement désactivé avec succès')
    })

    it('throw 404 si établissement introuvable (remonte en 500)', async () => {
      currentDb = createSelectAndUpdateChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Établissement introuvable'
      })
    })
  })

  // -----------------------------------------
  // PATCH /api/establishments/:id/update
  // -----------------------------------------
  describe('PATCH /api/establishments/:id/update', () => {
    it('met à jour l\'établissement', async () => {
      const updated = { id: 1, name: 'Boutique Modifiée', city: 'Lyon' }
      currentDb = createUpdateReturningChain([updated])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { name: 'Boutique Modifiée', city: 'Lyon' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.establishment).toMatchObject({ name: 'Boutique Modifiée' })
    })

    it('throw 400 si ID invalide (remonte en 500)', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: 'abc' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'ID d\'établissement invalide'
      })
    })

    it('throw 404 si établissement introuvable (remonte en 500)', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/establishments/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Établissement introuvable'
      })
    })
  })
})
