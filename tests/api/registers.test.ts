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

vi.mock('~/server/validators/register.schema', () => ({
  createRegisterSchema: {},
  updateRegisterSchema: {},
  CreateRegisterInput: {},
  UpdateRegisterInput: {}
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
  registers: {
    id: 'registers.id', name: 'registers.name', tenantId: 'registers.tenantId',
    establishmentId: 'registers.establishmentId', isActive: 'registers.isActive',
    createdAt: 'registers.createdAt', updatedAt: 'registers.updatedAt',
  },
  establishments: {
    id: 'establishments.id', name: 'establishments.name', city: 'establishments.city',
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

function createInsertChain(newItem: unknown) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newItem]))
      }))
    })),
  }
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

describe('API /api/registers', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/registers
  // -----------------------------------------
  describe('GET /api/registers', () => {
    it('retourne la liste des caisses avec success: true', async () => {
      const mockRegisters = [
        { id: 1, name: 'Caisse 1', establishmentId: 10, establishment: { id: 10, name: 'Boutique', city: 'Paris' } }
      ]
      currentDb = createReadChain(mockRegisters)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.registers).toHaveLength(1)
      expect(res.registers[0]).toMatchObject({ id: 1, name: 'Caisse 1' })
      expect(currentDb.leftJoin).toHaveBeenCalled()
    })

    it('filtre par establishmentId', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '10' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.registers).toEqual([])
    })
  })

  // -----------------------------------------
  // POST /api/registers/create
  // -----------------------------------------
  describe('POST /api/registers/create', () => {
    it('crée une caisse et retourne { success, register }', async () => {
      const newRegister = { id: 1, name: 'Caisse 1', establishmentId: 10, isActive: true }
      currentDb = createInsertChain(newRegister)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Caisse 1', establishmentId: 10 }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Caisse créée avec succès')
      expect(res.register).toMatchObject({ id: 1, name: 'Caisse 1' })
    })
  })

  // -----------------------------------------
  // DELETE /api/registers/:id/delete
  // -----------------------------------------
  describe('DELETE /api/registers/:id', () => {
    it('désactive la caisse (soft delete)', async () => {
      currentDb = createSelectAndUpdateChain([{ id: 1, name: 'Caisse 1' }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Caisse désactivée avec succès')
      expect(currentDb.update).toHaveBeenCalled()
    })

    it('throw 400 si ID invalide (remonte en 500 via catch)', async () => {
      currentDb = createSelectAndUpdateChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: 'abc' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'ID de caisse invalide'
      })
    })

    it('throw 404 si caisse introuvable (remonte en 500 via catch)', async () => {
      currentDb = createSelectAndUpdateChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Caisse introuvable'
      })
    })
  })

  // -----------------------------------------
  // PATCH /api/registers/:id/update
  // -----------------------------------------
  describe('PATCH /api/registers/:id/update', () => {
    it('met à jour la caisse', async () => {
      const updated = { id: 1, name: 'Caisse Modifiée', establishmentId: 10, isActive: true }
      currentDb = createUpdateReturningChain([updated])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { name: 'Caisse Modifiée' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.register).toMatchObject({ id: 1, name: 'Caisse Modifiée' })
    })

    it('throw 400 si ID invalide (remonte en 500 via catch)', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: 'abc' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'ID de caisse invalide'
      })
    })

    it('throw 404 si caisse introuvable (remonte en 500 via catch)', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/registers/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Caisse introuvable'
      })
    })
  })
})
