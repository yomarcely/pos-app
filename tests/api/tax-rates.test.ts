import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

// Override createError — tax-rates handlers use statusMessage
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.statusMessage = data.statusMessage || data.message
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

vi.mock('~/server/validators/tax-rate.schema', () => ({
  createTaxRateSchema: {},
  updateTaxRateSchema: {},
  CreateTaxRateInput: {},
  UpdateTaxRateInput: {}
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
  taxRates: {
    id: 'taxRates.id', name: 'taxRates.name', rate: 'taxRates.rate',
    code: 'taxRates.code', description: 'taxRates.description',
    isDefault: 'taxRates.isDefault', isArchived: 'taxRates.isArchived',
    archivedAt: 'taxRates.archivedAt', tenantId: 'taxRates.tenantId',
    updatedAt: 'taxRates.updatedAt', createdAt: 'taxRates.createdAt',
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
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return chain
}

function createWriteChain(newItem: unknown) {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([newItem])),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject)
        }))
      }))
    })),
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

describe('API /api/tax-rates', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/tax-rates
  // -----------------------------------------
  describe('GET /api/tax-rates', () => {
    it('retourne la liste des taux de TVA', async () => {
      const mockRates = [
        { id: 1, name: 'TVA 20%', rate: '20', code: 'N', isDefault: true },
        { id: 2, name: 'TVA 10%', rate: '10', code: 'R', isDefault: false }
      ]
      currentDb = createReadChain(mockRates)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res).toHaveLength(2)
      expect(res[0]).toMatchObject({ id: 1, name: 'TVA 20%' })
    })

    it('filtre avec includeArchived=true', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/index.get')).default as any
      const event = createMockEvent({ query: { includeArchived: 'true' } })

      const res = await handler(event)

      expect(res).toEqual([])
      // The where condition should be simpler (no isArchived filter)
      expect(currentDb.where).toHaveBeenCalled()
    })
  })

  // -----------------------------------------
  // POST /api/tax-rates/create
  // -----------------------------------------
  describe('POST /api/tax-rates/create', () => {
    it('crée un taux de TVA', async () => {
      const newRate = { id: 1, name: 'TVA 20%', rate: '20', code: 'N', isDefault: false }
      currentDb = createWriteChain(newRate)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'TVA 20%', rate: '20', code: 'N', isDefault: false }
      })

      const res = await handler(event)

      expect(res).toMatchObject({ id: 1, name: 'TVA 20%' })
      expect(currentDb.insert).toHaveBeenCalled()
      expect(currentDb.update).not.toHaveBeenCalled()
    })

    it('reset les autres taux par défaut si isDefault=true', async () => {
      const newRate = { id: 1, name: 'TVA 20%', rate: '20', code: 'N', isDefault: true }
      currentDb = createWriteChain(newRate)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'TVA 20%', rate: '20', code: 'N', isDefault: true }
      })

      const res = await handler(event)

      expect(res).toMatchObject({ isDefault: true })
      expect(currentDb.update).toHaveBeenCalled()
      expect(currentDb.insert).toHaveBeenCalled()
    })
  })

  // -----------------------------------------
  // DELETE /api/tax-rates/:id/delete
  // -----------------------------------------
  describe('DELETE /api/tax-rates/:id', () => {
    it('archive le taux de TVA (soft delete)', async () => {
      const archived = { id: 1, name: 'TVA 20%', isArchived: true }
      currentDb = createUpdateReturningChain([archived])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res).toMatchObject({ success: true, message: 'Taux de TVA archivé avec succès' })
    })

    it('throw 400 si ID invalide', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: 'abc' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: 'ID manquant'
      })
    })

    it('throw 404 si taux introuvable', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Taux de TVA introuvable'
      })
    })
  })

  // -----------------------------------------
  // PATCH /api/tax-rates/:id/update
  // -----------------------------------------
  describe('PATCH /api/tax-rates/:id/update', () => {
    it('met à jour un taux de TVA', async () => {
      const updated = { id: 1, name: 'TVA 5.5%', rate: '5.5', code: 'R2', isDefault: false }
      currentDb = createWriteChain(updated)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { name: 'TVA 5.5%', rate: '5.5', code: 'R2' }
      })

      const res = await handler(event)

      expect(res).toMatchObject({ id: 1, name: 'TVA 5.5%' })
    })

    it('throw 400 si ID invalide', async () => {
      currentDb = createWriteChain({})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: 'abc' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: 'ID manquant'
      })
    })

    it('throw 404 si taux introuvable', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/tax-rates/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Taux de TVA introuvable'
      })
    })
  })
})
