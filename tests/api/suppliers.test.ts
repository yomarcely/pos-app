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

vi.mock('~/server/validators/supplier.schema', () => ({
  createSupplierSchema: {},
  updateSupplierSchema: {},
  CreateSupplierInput: {}
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
  suppliers: {
    id: 'suppliers.id', name: 'suppliers.name', tenantId: 'suppliers.tenantId',
    isArchived: 'suppliers.isArchived', createdByEstablishmentId: 'suppliers.createdByEstablishmentId',
  },
  syncGroupEstablishments: {
    id: 'sge.id', syncGroupId: 'sge.syncGroupId',
    establishmentId: 'sge.establishmentId', tenantId: 'sge.tenantId',
  },
  products: {
    id: 'products.id', tenantId: 'products.tenantId',
    supplierId: 'products.supplierId', brandId: 'products.brandId',
  }
}))

// Ordre des opérations : contrôle produits, transaction tenant, journal d'audit.
const ops = vi.hoisted(() => ({ log: [] as string[] }))

const auditMocks = vi.hoisted(() => ({
  logEntityCreation: vi.fn(async () => { ops.log.push('audit') }),
  logEntityUpdate: vi.fn(async () => { ops.log.push('audit') }),
  logEntityDeletion: vi.fn(async () => { ops.log.push('audit') }),
}))

/**
 * Remplace le `db` global tant qu'une transaction tenant est ouverte : y toucher lève une
 * erreur. Dans `fn`, seul `tx` est permis — un accès à `db` contournerait la RLS et, sur le
 * pooler à 1 connexion, attendrait la connexion que la transaction occupe (invariant 8).
 */
const dbInterdit = new Proxy({}, {
  get: (_target, prop) => () => {
    throw new Error(`db.${String(prop)} utilisé pendant withTenantTx : passer par tx (invariant 8)`)
  },
})

// A4a : la requête sur la table protégée passe par withTenantTx. Ici `tx` est la base
// simulée ; le vrai comportement RLS est vérifié dans tests/integration/.
const tenantTxMock = vi.hoisted(() => ({
  withTenantTx: vi.fn(async (tenantId: string, fn: (tx: unknown) => Promise<unknown>) => {
    ops.log.push(`tx:debut:${tenantId}`)
    const tx = currentDb
    currentDb = dbInterdit
    try {
      return await fn(tx)
    } finally {
      currentDb = tx
      ops.log.push('tx:fin')
    }
  }),
}))

vi.mock('~/server/database/tenantTx', () => tenantTxMock)

vi.mock('~/server/utils/audit', () => auditMocks)

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
 * Base simulée pour modification / suppression :
 * - select().from().where().limit() → produits qui utilisent l'entité (contrôle avant suppression)
 * - update().set().where().returning() → lignes modifiées
 * - delete().where().returning() → lignes supprimées
 */
function createWriteDb(opts: { productsUsing?: unknown[]; updated?: unknown[]; deleted?: unknown[] } = {}) {
  const set = vi.fn(() => ({
    where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(opts.updated ?? [])) })),
  }))
  return {
    select: vi.fn(() => {
      ops.log.push('controle-produits')
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(opts.productsUsing ?? [])) })),
        })),
      }
    }),
    update: vi.fn(() => ({ set })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(opts.deleted ?? [])) })),
    })),
    set,
  }
}

// ===========================================
// Tests
// ===========================================

describe('API /api/suppliers', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(auditMocks).forEach(m => m.mockClear())
    tenantTxMock.withTenantTx.mockClear()
    ops.log.length = 0
  })

  describe('GET /api/suppliers', () => {
    it('retourne la liste des fournisseurs', async () => {
      const mockSuppliers = [
        { id: 1, name: 'Fournisseur A', tenantId: 'test-tenant-id' },
        { id: 2, name: 'Fournisseur B', tenantId: 'test-tenant-id' }
      ]
      currentDb = createReadChain(mockSuppliers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res).toHaveLength(2)
      expect(res[0]).toMatchObject({ id: 1, name: 'Fournisseur A' })
    })

    it('filtre par establishmentId via syncGroupEstablishments', async () => {
      const mockSuppliers = [{ id: 1, name: 'Fournisseur A' }]
      currentDb = createSyncFilterChain(
        [{ syncGroupId: 10 }],
        [{ establishmentId: 5 }, { establishmentId: 6 }],
        mockSuppliers
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '5' } })

      const res = await handler(event)

      expect(res).toEqual(mockSuppliers)
      expect(currentDb.select).toHaveBeenCalledTimes(3)
    })

    it('filtre par establishmentId seul si aucun syncGroup', async () => {
      const mockSuppliers = [{ id: 1, name: 'Fournisseur A' }]
      currentDb = createSyncFilterChain([], [], mockSuppliers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '5' } })

      const res = await handler(event)

      expect(res).toEqual(mockSuppliers)
      expect(currentDb.select).toHaveBeenCalledTimes(2)
    })
  })

  describe('POST /api/suppliers/create', () => {
    it('crée un fournisseur et retourne le résultat', async () => {
      const newSupplier = { id: 1, name: 'Fournisseur A', tenantId: 'test-tenant-id', contact: 'Jean', email: 'jean@test.com' }
      currentDb = createInsertChain(newSupplier)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/create.post')).default as any
      const event = createMockEvent({
        body: { name: 'Fournisseur A', contact: 'Jean', email: 'jean@test.com' },
        query: { establishmentId: '5' }
      })

      const res = await handler(event)

      expect(res).toMatchObject({ id: 1, name: 'Fournisseur A' })
      expect(currentDb.insert).toHaveBeenCalled()
    })
  })

  // Caractérisation (A4a) : comportement figé AVANT le passage par withTenantTx.
  describe('PATCH /api/suppliers/:id', () => {
    it('modifie le fournisseur, nettoie le nom et écrit au journal d\'audit', async () => {
      const updated = { id: 7, name: 'Fournisseur Z', tenantId: 'test-tenant-id' }
      currentDb = createWriteDb({ updated: [updated] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/update.patch')).default as any
      const event = createMockEvent({ params: { id: '7' }, body: { name: '  Fournisseur Z  ' } })

      const res = await handler(event)

      expect(res).toEqual(updated)
      expect(currentDb.update).toHaveBeenCalledTimes(1)
      expect(currentDb.set).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fournisseur Z' }))
      expect(auditMocks.logEntityUpdate).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'test-tenant-id', entityType: 'supplier', entityId: 7,
      }))
    })

    it('répond 404 si la ligne n\'existe pas pour ce tenant, sans écrire au journal d\'audit', async () => {
      currentDb = createWriteDb({ updated: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/update.patch')).default as any
      const event = createMockEvent({ params: { id: '7' }, body: { name: 'X' } })

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 404, message: 'Fournisseur introuvable' })
      expect(auditMocks.logEntityUpdate).not.toHaveBeenCalled()
    })

    it('répond 400 si l\'identifiant est invalide, sans toucher à la base', async () => {
      currentDb = createWriteDb()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/update.patch')).default as any
      const event = createMockEvent({ params: { id: 'abc' }, body: { name: 'X' } })

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 })
      expect(currentDb.update).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/suppliers/:id', () => {
    it('supprime le fournisseur et écrit au journal d\'audit', async () => {
      const deleted = { id: 7, name: 'Fournisseur Z', tenantId: 'test-tenant-id' }
      currentDb = createWriteDb({ productsUsing: [], deleted: [deleted] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '7' } })

      const res = await handler(event)

      expect(res).toEqual({ success: true, message: 'Fournisseur supprimé avec succès' })
      expect(currentDb.select).toHaveBeenCalledTimes(1)
      expect(currentDb.delete).toHaveBeenCalledTimes(1)
      expect(auditMocks.logEntityDeletion).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'test-tenant-id', entityType: 'supplier', entityId: 7,
      }))
    })

    it('répond 409 si des produits l\'utilisent, sans rien supprimer', async () => {
      currentDb = createWriteDb({ productsUsing: [{ id: 1 }] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '7' } })

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 409, message: 'Ce fournisseur est utilisé par des produits et ne peut pas être supprimé' })
      expect(currentDb.delete).not.toHaveBeenCalled()
      expect(auditMocks.logEntityDeletion).not.toHaveBeenCalled()
    })

    it('répond 404 si la ligne n\'existe pas pour ce tenant, sans écrire au journal d\'audit', async () => {
      currentDb = createWriteDb({ productsUsing: [], deleted: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '7' } })

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 404, message: 'Fournisseur introuvable' })
      expect(auditMocks.logEntityDeletion).not.toHaveBeenCalled()
    })

    it('répond 400 si l\'identifiant est invalide, sans toucher à la base', async () => {
      currentDb = createWriteDb()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/delete.delete')).default as any
      const event = createMockEvent({ params: { id: '0' } })

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 })
      expect(currentDb.select).not.toHaveBeenCalled()
      expect(currentDb.delete).not.toHaveBeenCalled()
    })
  })

  describe('Transaction tenant (A4a)', () => {
    it('garde-fou du montage : toucher au db global pendant la transaction échoue, puis il est rendu', async () => {
      currentDb = createReadChain([])
      const connection = await import('~/server/database/connection')

      await expect(tenantTxMock.withTenantTx('test-tenant-id', async () => connection.db.select()))
        .rejects.toThrow('invariant 8')
      expect(() => connection.db.select()).not.toThrow()
    })

    it('la liste lit la table dans withTenantTx, avec le tenant de la session', async () => {
      currentDb = createReadChain([{ id: 1, name: 'A' }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/index.get')).default as any

      await handler(createMockEvent())

      expect(tenantTxMock.withTenantTx).toHaveBeenCalledTimes(1)
      expect(tenantTxMock.withTenantTx).toHaveBeenCalledWith('test-tenant-id', expect.any(Function))
    })

    it('la liste filtrée lit les groupes de synchro HORS transaction, puis la table dedans', async () => {
      currentDb = createSyncFilterChain([{ syncGroupId: 10 }], [{ establishmentId: 5 }], [])
      const selectsAtTxStart: number[] = []
      const original = tenantTxMock.withTenantTx.getMockImplementation()!
      tenantTxMock.withTenantTx.mockImplementationOnce(async (tenantId, fn) => {
        selectsAtTxStart.push(currentDb.select.mock.calls.length)
        return original(tenantId, fn)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/index.get')).default as any

      await handler(createMockEvent({ query: { establishmentId: '5' } }))

      // Les 2 lectures de sync_group_establishments (table sans règle pour le rôle) sont déjà faites.
      expect(selectsAtTxStart).toEqual([2])
      expect(currentDb.select).toHaveBeenCalledTimes(3)
    })

    it('la création écrit dans withTenantTx, puis le journal d\'audit une fois la transaction terminée', async () => {
      currentDb = createInsertChain({ id: 1, name: 'A', tenantId: 'test-tenant-id' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/create.post')).default as any

      await handler(createMockEvent({ body: { name: 'A' } }))

      expect(ops.log).toEqual(['tx:debut:test-tenant-id', 'tx:fin', 'audit'])
    })

    it('la modification écrit dans withTenantTx, puis le journal d\'audit une fois la transaction terminée', async () => {
      currentDb = createWriteDb({ updated: [{ id: 7, name: 'A' }] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/update.patch')).default as any

      await handler(createMockEvent({ params: { id: '7' }, body: { name: 'A' } }))

      expect(ops.log).toEqual(['tx:debut:test-tenant-id', 'tx:fin', 'audit'])
    })

    it('la suppression contrôle les produits AVANT la transaction et écrit l\'audit APRÈS', async () => {
      currentDb = createWriteDb({ productsUsing: [], deleted: [{ id: 7, name: 'A' }] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/delete.delete')).default as any

      await handler(createMockEvent({ params: { id: '7' } }))

      expect(ops.log).toEqual(['controle-produits', 'tx:debut:test-tenant-id', 'tx:fin', 'audit'])
    })

    it('la suppression refusée (409) n\'ouvre pas de transaction', async () => {
      currentDb = createWriteDb({ productsUsing: [{ id: 1 }] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/delete.delete')).default as any

      await expect(handler(createMockEvent({ params: { id: '7' } }))).rejects.toMatchObject({ statusCode: 409 })
      expect(tenantTxMock.withTenantTx).not.toHaveBeenCalled()
    })

    it('une erreur de la base dans la transaction ressort en 500, sans journal d\'audit', async () => {
      currentDb = createWriteDb({ updated: [{ id: 7, name: 'A' }] })
      tenantTxMock.withTenantTx.mockRejectedValueOnce(new Error('new row violates row-level security policy'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/suppliers/[id]/update.patch')).default as any

      await expect(handler(createMockEvent({ params: { id: '7' }, body: { name: 'A' } })))
        .rejects.toMatchObject({ statusCode: 500 })
      expect(auditMocks.logEntityUpdate).not.toHaveBeenCalled()
    })
  })
})
