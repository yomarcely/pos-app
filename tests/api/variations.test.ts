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

vi.mock('~/server/validators/variation.schema', () => ({
  createVariationGroupSchema: {},
  updateVariationGroupSchema: {},
  createVariationSchema: {},
  updateVariationSchema: {},
  CreateVariationGroupInput: {},
  UpdateVariationGroupInput: {},
  CreateVariationInput: {},
  UpdateVariationInput: {}
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
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  ne: (...args: unknown[]) => ({ type: 'ne', args })
}))

vi.mock('~/server/database/schema', () => ({
  variationGroups: {
    id: 'variationGroups.id', name: 'variationGroups.name',
    tenantId: 'variationGroups.tenantId', isArchived: 'variationGroups.isArchived',
    archivedAt: 'variationGroups.archivedAt', updatedAt: 'variationGroups.updatedAt',
    createdByEstablishmentId: 'variationGroups.createdByEstablishmentId',
  },
  variations: {
    id: 'variations.id', name: 'variations.name', groupId: 'variations.groupId',
    sortOrder: 'variations.sortOrder', tenantId: 'variations.tenantId',
    isArchived: 'variations.isArchived', archivedAt: 'variations.archivedAt',
    updatedAt: 'variations.updatedAt',
  },
  syncGroupEstablishments: {
    id: 'sge.id', syncGroupId: 'sge.syncGroupId',
    establishmentId: 'sge.establishmentId', tenantId: 'sge.tenantId',
  }
}))

// ===========================================
// Helpers
// ===========================================

/**
 * For variations GET: groups query + variations query (2 sequential selects).
 * If establishmentId, there are additional sync group queries first.
 */
function createVariationsGetChain(groups: unknown[], allVariations: unknown[]) {
  const results = [groups, allVariations]
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

/**
 * For variation create: 1 select (group check) + 1 insert
 */
function createVariationCreateChain(group: unknown | null, newVariation: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(group ? [group] : []).then(resolve, reject),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newVariation]))
      }))
    })),
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

/**
 * For variation update: 1 select (existence check) + 1 update with returning
 */
function createSelectThenUpdateChain(existingRows: unknown[], updateResult: unknown[]) {
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
          returning: vi.fn(() => Promise.resolve(updateResult)),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject)
        }))
      }))
    })),
  }
  return chain
}

/**
 * For group delete: 2 selects (group check + variations check) + 1 update
 */
function createGroupDeleteChain(existingGroup: unknown[], variationsInGroup: unknown[]) {
  const selectResults = [existingGroup, variationsInGroup]
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

describe('API /api/variations', () => {
  beforeEach(() => { vi.resetModules() })

  // -----------------------------------------
  // GET /api/variations
  // -----------------------------------------
  describe('GET /api/variations', () => {
    it('retourne les groupes avec leurs variations', async () => {
      const groups = [{ id: 1, name: 'Couleur' }, { id: 2, name: 'Taille' }]
      const allVariations = [
        { id: 10, name: 'Rouge', groupId: 1, sortOrder: 0, tenantId: 'test-tenant-id', isArchived: false },
        { id: 11, name: 'Bleu', groupId: 1, sortOrder: 1, tenantId: 'test-tenant-id', isArchived: false },
        { id: 20, name: 'S', groupId: 2, sortOrder: 0, tenantId: 'test-tenant-id', isArchived: false },
      ]
      currentDb = createVariationsGetChain(groups, allVariations)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.groups).toHaveLength(2)
      expect(res.groups[0].variations).toHaveLength(2)
      expect(res.groups[1].variations).toHaveLength(1)
    })

    it('retourne des groupes vides si aucune variation', async () => {
      currentDb = createVariationsGetChain([{ id: 1, name: 'Couleur' }], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.groups[0].variations).toEqual([])
    })
  })

  // -----------------------------------------
  // POST /api/variations/create
  // -----------------------------------------
  describe('POST /api/variations/create', () => {
    it('crée une variation dans un groupe existant', async () => {
      const newVariation = { id: 10, name: 'Rouge', groupId: 1, sortOrder: 0 }
      currentDb = createVariationCreateChain({ id: 1, name: 'Couleur' }, newVariation)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Rouge', groupId: 1, sortOrder: 0 }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.variation).toMatchObject({ id: 10, name: 'Rouge' })
    })

    it('throw 404 si groupe inexistant (remonte en 500)', async () => {
      currentDb = createVariationCreateChain(null, {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Rouge', groupId: 999, sortOrder: 0 }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Groupe de variation introuvable'
      })
    })
  })

  // -----------------------------------------
  // DELETE /api/variations/:id/delete
  // -----------------------------------------
  describe('DELETE /api/variations/:id', () => {
    it('archive la variation (soft delete)', async () => {
      currentDb = createSelectAndUpdateChain([{ id: 10, name: 'Rouge' }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '10' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Variation supprimée avec succès')
    })

    it('throw 404 si variation introuvable (remonte en 500)', async () => {
      currentDb = createSelectAndUpdateChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Variation introuvable'
      })
    })
  })

  // -----------------------------------------
  // PATCH /api/variations/:id/update
  // -----------------------------------------
  describe('PATCH /api/variations/:id/update', () => {
    it('met à jour la variation', async () => {
      const updated = { id: 10, name: 'Rouge foncé', sortOrder: 1 }
      currentDb = createSelectThenUpdateChain([{ id: 10, name: 'Rouge' }], [updated])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '10' },
        body: { name: 'Rouge foncé', sortOrder: 1 }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.variation).toMatchObject({ name: 'Rouge foncé' })
    })

    it('throw 404 si variation introuvable (remonte en 500)', async () => {
      currentDb = createSelectThenUpdateChain([], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Variation introuvable'
      })
    })
  })

  // -----------------------------------------
  // GET /api/variations/groups (alias)
  // -----------------------------------------
  describe('GET /api/variations/groups', () => {
    it('retourne les groupes avec variations (même logique que GET /variations)', async () => {
      const groups = [{ id: 1, name: 'Taille' }]
      const allVariations = [
        { id: 20, name: 'S', groupId: 1, sortOrder: 0, tenantId: 'test-tenant-id', isArchived: false },
      ]
      currentDb = createVariationsGetChain(groups, allVariations)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/groups.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.groups).toHaveLength(1)
    })
  })

  // -----------------------------------------
  // POST /api/variations/groups/create
  // -----------------------------------------
  describe('POST /api/variations/groups/create', () => {
    it('crée un groupe de variation', async () => {
      const newGroup = { id: 1, name: 'Couleur' }
      currentDb = createInsertChain(newGroup)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/groups/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Couleur' },
        query: { establishmentId: '5' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.group).toMatchObject({ id: 1, name: 'Couleur' })
    })
  })

  // -----------------------------------------
  // DELETE /api/variations/groups/:id/delete
  // -----------------------------------------
  describe('DELETE /api/variations/groups/:id', () => {
    it('archive le groupe de variation', async () => {
      currentDb = createGroupDeleteChain([{ id: 1, name: 'Couleur' }], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/groups/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Groupe de variation supprimé avec succès')
    })

    it('throw 400 si variations existent dans le groupe (remonte en 500)', async () => {
      currentDb = createGroupDeleteChain([{ id: 1, name: 'Couleur' }], [{ id: 10, name: 'Rouge' }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/groups/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 500 })
    })

    it('throw 404 si groupe introuvable (remonte en 500)', async () => {
      currentDb = createGroupDeleteChain([], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/groups/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Groupe de variation introuvable'
      })
    })
  })

  // -----------------------------------------
  // PATCH /api/variations/groups/:id/update
  // -----------------------------------------
  describe('PATCH /api/variations/groups/:id/update', () => {
    it('met à jour le groupe de variation', async () => {
      const updated = { id: 1, name: 'Couleurs vives' }
      currentDb = createUpdateReturningChain([updated])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/groups/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { name: 'Couleurs vives' }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.group).toMatchObject({ name: 'Couleurs vives' })
    })

    it('throw 404 si groupe introuvable (remonte en 500)', async () => {
      currentDb = createUpdateReturningChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/variations/groups/[id]/update.patch')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { name: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Groupe de variation introuvable'
      })
    })
  })
})
