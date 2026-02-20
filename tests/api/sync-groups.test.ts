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

vi.mock('~/server/validators/sync.schema', () => ({
  createSyncGroupSchema: { parse: vi.fn((data: unknown) => data) },
  updateSyncRulesSchema: { parse: vi.fn((data: unknown) => data) },
  updateProductStockSchema: { parse: vi.fn((data: unknown) => data) },
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
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}))

vi.mock('~/server/database/schema', () => ({
  syncGroups: {
    id: 'sg.id', name: 'sg.name', description: 'sg.description',
    tenantId: 'sg.tenantId', createdAt: 'sg.createdAt',
  },
  syncGroupEstablishments: {
    id: 'sge.id', syncGroupId: 'sge.syncGroupId',
    establishmentId: 'sge.establishmentId', tenantId: 'sge.tenantId',
  },
  establishments: {
    id: 'establishments.id', name: 'establishments.name',
    city: 'establishments.city', address: 'establishments.address',
    postalCode: 'establishments.postalCode',
  },
  syncRules: {
    id: 'sr.id', syncGroupId: 'sr.syncGroupId', tenantId: 'sr.tenantId',
    entityType: 'sr.entityType', updatedAt: 'sr.updatedAt',
  },
}))

// ===========================================
// Helpers
// ===========================================

/**
 * For sync-groups GET list: N sequential selects
 * select #1: groups, select #2: establishments (for group), select #3: rules (for group)
 */
function createSyncGroupsListChain(groups: unknown[], establishments: unknown[], rules: unknown[]) {
  let selectIdx = 0
  const results = [groups, establishments, rules]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => { selectIdx++; return chain }),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(results[selectIdx - 1] || []).then(resolve, reject),
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

/**
 * For sync-groups delete: 1 select + 1 delete
 */
function createSelectAndDeleteChain(existingRows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(existingRows).then(resolve, reject),
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
 * For rules update: 1 select (group check) + 1 update with returning
 */
function createSelectAndUpdateReturningChain(group: unknown | null, updatedRules: unknown | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(group ? [group] : []).then(resolve, reject),
  }
  return {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(updatedRules ? [updatedRules] : []))
        }))
      }))
    })),
  }
}

// ===========================================
// Tests
// ===========================================

describe('API /api/sync-groups', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/sync-groups
  // -----------------------------------------
  describe('GET /api/sync-groups', () => {
    it('retourne les groupes avec établissements et règles', async () => {
      const groups = [{ id: 1, name: 'Groupe A', tenantId: 'test-tenant-id' }]
      const estabs = [{ id: 10, name: 'Boutique Paris', city: 'Paris' }]
      const rules = [{ id: 100, entityType: 'product', syncGroupId: 1 }]
      currentDb = createSyncGroupsListChain(groups, estabs, rules)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.syncGroups).toHaveLength(1)
      expect(res.syncGroups[0].establishments).toHaveLength(1)
      expect(res.syncGroups[0].establishmentCount).toBe(1)
    })
  })

  // -----------------------------------------
  // POST /api/sync-groups/create
  // -----------------------------------------
  describe('POST /api/sync-groups/create', () => {
    it('crée un groupe avec établissements et règles', async () => {
      const newGroup = { id: 1, name: 'Groupe A', description: 'Test' }
      currentDb = createInsertChain(newGroup)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Groupe A', description: 'Test', establishmentIds: [10, 20] }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.syncGroup).toMatchObject({ id: 1, name: 'Groupe A' })
      expect(res.message).toBe('Groupe de synchronisation créé avec succès')
      // insert called: syncGroups + syncGroupEstablishments + productRules + customerRules
      expect(currentDb.insert).toHaveBeenCalledTimes(4)
    })
  })

  // -----------------------------------------
  // GET /api/sync-groups/:id
  // -----------------------------------------
  describe('GET /api/sync-groups/:id', () => {
    it('retourne le groupe avec détails', async () => {
      const group = { id: 1, name: 'Groupe A', tenantId: 'test-tenant-id' }
      const estabs = [{ id: 10, name: 'Boutique', city: 'Paris', address: '1 rue', postalCode: '75001' }]
      const rules = [{ id: 100, entityType: 'product', syncGroupId: 1 }]
      currentDb = createSyncGroupsListChain([group], estabs, rules)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/[id]/index.get')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.syncGroup.name).toBe('Groupe A')
      expect(res.syncGroup.establishments).toHaveLength(1)
    })

    it('throw 400 si ID invalide', async () => {
      currentDb = createSyncGroupsListChain([], [], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/[id]/index.get')).default as any
      const event = createMockEvent({ params: { id: 'abc' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: 'ID du groupe invalide'
      })
    })

    it('throw 404 si groupe introuvable', async () => {
      currentDb = createSyncGroupsListChain([], [], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/[id]/index.get')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Groupe de synchronisation non trouvé'
      })
    })
  })

  // -----------------------------------------
  // DELETE /api/sync-groups/:id
  // -----------------------------------------
  describe('DELETE /api/sync-groups/:id', () => {
    it('supprime le groupe (cascade)', async () => {
      currentDb = createSelectAndDeleteChain([{ id: 1, name: 'Groupe A', tenantId: 'test-tenant-id' }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Groupe de synchronisation supprimé avec succès')
    })

    it('throw 404 si groupe introuvable', async () => {
      currentDb = createSelectAndDeleteChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Groupe de synchronisation non trouvé'
      })
    })
  })

  // -----------------------------------------
  // PATCH /api/sync-groups/:id/rules
  // -----------------------------------------
  describe('PATCH /api/sync-groups/:id/rules', () => {
    it('met à jour les règles de synchronisation', async () => {
      const group = { id: 1, name: 'Groupe A', tenantId: 'test-tenant-id' }
      const updatedRules = { id: 100, entityType: 'product', syncGroupId: 1, syncName: true }
      currentDb = createSelectAndUpdateReturningChain(group, updatedRules)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/[id]/rules.patch')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { entityType: 'product', syncName: true }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.rules).toBeDefined()
      expect(res.message).toBe('Règles de synchronisation mises à jour avec succès')
    })

    it('throw 404 si groupe introuvable', async () => {
      currentDb = createSelectAndUpdateReturningChain(null, null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/sync-groups/[id]/rules.patch')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { entityType: 'product', syncName: true }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Groupe de synchronisation non trouvé'
      })
    })
  })
})
