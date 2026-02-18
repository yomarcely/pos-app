import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

// Override createError pour retourner un vrai Error (les handlers font instanceof Error)
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error(data.message as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}

// Mock getRequestIP utilisé dans index.post.ts
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

// ===========================================
// Mocks des utilitaires serveur
// ===========================================

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id')
}))

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }))
  }
}))

vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (_event: unknown) => {
    const event = _event as { body?: unknown }
    return event?.body || {}
  })
}))

vi.mock('~/server/validators/customer.schema', () => ({
  createClientSchema: {},
  CreateClientInput: {}
}))

vi.mock('~/server/utils/sync', () => ({
  syncCustomerToGroup: vi.fn(() => Promise.resolve())
}))

// ===========================================
// Mocks de base de données
// ===========================================

interface MockDbChain {
  select: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
  leftJoin: ReturnType<typeof vi.fn>
  innerJoin: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  groupBy: ReturnType<typeof vi.fn>
  having: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  offset: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

let currentDb: MockDbChain

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
  customers: {
    id: 'customers.id',
    firstName: 'customers.firstName',
    lastName: 'customers.lastName',
    email: 'customers.email',
    phone: 'customers.phone',
    address: 'customers.address',
    metadata: 'customers.metadata',
    gdprConsent: 'customers.gdprConsent',
    gdprConsentDate: 'customers.gdprConsentDate',
    marketingConsent: 'customers.marketingConsent',
    loyaltyProgram: 'customers.loyaltyProgram',
    discount: 'customers.discount',
    notes: 'customers.notes',
    createdAt: 'customers.createdAt',
    updatedAt: 'customers.updatedAt',
    tenantId: 'customers.tenantId'
  },
  customerEstablishments: {
    id: 'ce.id',
    customerId: 'ce.customerId',
    establishmentId: 'ce.establishmentId',
    tenantId: 'ce.tenantId'
  },
  establishments: {
    id: 'establishments.id',
    tenantId: 'establishments.tenantId'
  },
  auditLogs: {
    id: 'auditLogs.id',
    tenantId: 'auditLogs.tenantId'
  },
  sales: {
    id: 'sales.id',
    customerId: 'sales.customerId',
    tenantId: 'sales.tenantId',
    status: 'sales.status',
    totalTTC: 'sales.totalTTC'
  }
}))

// ===========================================
// Helpers
// ===========================================

function createReadChain(rows: unknown[]) {
  const chain: MockDbChain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve(rows)),
    limit: vi.fn(() => Promise.resolve(rows)),
    offset: vi.fn(() => chain),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
  return chain
}

/**
 * Creates a db mock for POST /api/clients that handles the complex chain:
 * 1. insert(customers).values(...).returning() -> [newClient]
 * 2. select().from(establishments).where(...).limit(2) -> estabs (fallback lookup)
 * 3. select().from(customerEstablishments).where(...).limit(1) -> existingLink
 * 4. insert(customerEstablishments).values(...)
 * 5. insert(auditLogs).values(...)
 */
function createPostChain(newClient: Record<string, unknown>, options?: {
  establishmentRows?: unknown[]
  existingLinkRows?: unknown[]
}) {
  const estabRows = options?.establishmentRows ?? []
  const linkRows = options?.existingLinkRows ?? []

  // Track select call count to return different results
  let selectCallCount = 0

  const chain: MockDbChain = {
    select: vi.fn(() => {
      selectCallCount++
      return chain
    }),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve([])),
    limit: vi.fn((n: number) => {
      // limit(2) = establishments fallback, limit(1) = existingLink check
      if (n === 2) return Promise.resolve(estabRows)
      return Promise.resolve(linkRows)
    }),
    offset: vi.fn(() => chain),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([newClient]))
      }))
    })),
    update: vi.fn(),
    delete: vi.fn()
  }
  return chain
}

/**
 * Creates a db mock for PUT /api/clients/:id
 * 1. select().from(customers).where(...).limit(1) -> existence check
 * 2. update(customers).set(...).where(...).returning() -> [updatedClient]
 */
function createPutChain(existingClient: Record<string, unknown> | null, updatedClient: Record<string, unknown>) {
  const chain: MockDbChain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve([])),
    limit: vi.fn(() => Promise.resolve(existingClient ? [existingClient] : [])),
    offset: vi.fn(() => chain),
    insert: vi.fn(),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([updatedClient]))
        }))
      }))
    })),
    delete: vi.fn()
  }
  return chain
}

/**
 * Creates a db mock for DELETE /api/clients/:id
 * 1. select().from(customers).where(...).limit(1) -> existence check
 * 2. delete(customers).where(...)
 */
function createDeleteChain(existingRows: unknown[]) {
  const chain: MockDbChain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve([])),
    limit: vi.fn(() => Promise.resolve(existingRows)),
    offset: vi.fn(() => chain),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve())
    }))
  }
  return chain
}

// ===========================================
// Tests
// ===========================================

describe('API /api/clients', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  // -----------------------------------------
  // GET /api/clients (index.get.ts)
  // -----------------------------------------
  describe('GET /api/clients (index.get)', () => {
    it('retourne la liste des clients avec success: true et clients[]', async () => {
      const mockRows = [{
        id: 1,
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@test.com',
        phone: '0601020304',
        address: '1 rue de Paris',
        metadata: { city: 'Paris' },
        gdprConsent: true,
        gdprConsentDate: new Date(),
        marketingConsent: false,
        loyaltyProgram: true,
        discount: '10',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalRevenue: '150.50'
      }]

      currentDb = createReadChain(mockRows)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.clients).toHaveLength(1)
      expect(res.count).toBe(1)
      expect(res.clients[0]).toMatchObject({
        id: 1,
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@test.com',
        totalRevenue: 150.5,
        city: 'Paris'
      })
    })

    it('retourne liste vide si aucun client', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/index.get')).default as any
      const event = createMockEvent()

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.clients).toEqual([])
      expect(res.count).toBe(0)
    })

    it('appelle innerJoin si establishmentId fourni', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/index.get')).default as any
      const event = createMockEvent({ query: { establishmentId: '5' } })

      await handler(event)

      expect(currentDb.innerJoin).toHaveBeenCalled()
    })

    it('applique la recherche si search fourni (having)', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/index.get')).default as any
      const event = createMockEvent({ query: { search: 'Jean' } })

      await handler(event)

      expect(currentDb.having).toHaveBeenCalled()
    })
  })

  // -----------------------------------------
  // POST /api/clients (index.post.ts)
  // -----------------------------------------
  describe('POST /api/clients (index.post)', () => {
    const newClient = {
      id: 42,
      tenantId: 'test-tenant-id',
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'marie@test.com',
      phone: null,
      address: null,
      gdprConsent: true,
      gdprConsentDate: new Date(),
      marketingConsent: false,
      loyaltyProgram: false,
      discount: '0',
      notes: null,
      alerts: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }

    it('crée un client et retourne { success, client, message }', async () => {
      currentDb = createPostChain(newClient)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/index.post')).default as any
      const event = createMockEvent({
        body: { firstName: 'Marie', lastName: 'Martin', email: 'marie@test.com', gdprConsent: true }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.client).toMatchObject({ id: 42, firstName: 'Marie' })
      expect(res.message).toBe('Client créé avec succès')
      expect(currentDb.insert).toHaveBeenCalled()
    })

    it('lie le client à l\'établissement si establishmentId en query', async () => {
      currentDb = createPostChain(newClient, { existingLinkRows: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/index.post')).default as any
      const event = createMockEvent({
        query: { establishmentId: '10' },
        body: { firstName: 'Marie', lastName: 'Martin', gdprConsent: true }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      // insert is called multiple times: customers + customerEstablishments + auditLogs
      expect(currentDb.insert).toHaveBeenCalledTimes(3)
    })

    it('écrit un audit log RGPD si auth.user.id présent', async () => {
      currentDb = createPostChain(newClient)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/index.post')).default as any
      const event = createMockEvent({
        body: { firstName: 'Marie', lastName: 'Martin', gdprConsent: true },
        auth: { user: { id: 'user-123' } }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      // insert called for: customers + auditLogs (no establishmentId => no CE insert)
      expect(currentDb.insert).toHaveBeenCalledTimes(2)
    })
  })

  // -----------------------------------------
  // GET /api/clients/:id ([id].get.ts)
  // -----------------------------------------
  describe('GET /api/clients/:id ([id].get)', () => {
    const mockClient = {
      id: 1,
      tenantId: 'test-tenant-id',
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean@test.com'
    }

    it('retourne le client par ID', async () => {
      currentDb = createReadChain([mockClient])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/[id].get')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.client).toMatchObject({ id: 1, firstName: 'Jean' })
    })

    it('throw 400 si ID invalide', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/[id].get')).default as any
      const event = createMockEvent({ params: { id: 'abc' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: 'ID client invalide'
      })
    })

    it('throw 404 si client non trouvé', async () => {
      currentDb = createReadChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/[id].get')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Client non trouvé'
      })
    })
  })

  // -----------------------------------------
  // PUT /api/clients/:id ([id].put.ts)
  // -----------------------------------------
  describe('PUT /api/clients/:id ([id].put)', () => {
    const existingClient = {
      id: 1,
      tenantId: 'test-tenant-id',
      firstName: 'Jean',
      lastName: 'Dupont',
      gdprConsentDate: null
    }

    const updatedClient = {
      id: 1,
      tenantId: 'test-tenant-id',
      firstName: 'Jean-Pierre',
      lastName: 'Dupont',
      email: 'jp@test.com'
    }

    it('met à jour et retourne le client modifié', async () => {
      currentDb = createPutChain(existingClient, updatedClient)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/[id].put')).default as any
      const event = createMockEvent({
        params: { id: '1' },
        body: { firstName: 'Jean-Pierre', lastName: 'Dupont', email: 'jp@test.com', gdprConsent: true }
      })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.client).toMatchObject({ id: 1, firstName: 'Jean-Pierre' })
      expect(res.message).toBe('Client mis à jour avec succès')
      expect(currentDb.update).toHaveBeenCalled()
    })

    it('throw 400 si ID invalide', async () => {
      currentDb = createPutChain(null, {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/[id].put')).default as any
      const event = createMockEvent({
        params: { id: 'abc' },
        body: { firstName: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: 'ID client invalide'
      })
    })

    it('throw 404 si client inexistant', async () => {
      currentDb = createPutChain(null, {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/[id].put')).default as any
      const event = createMockEvent({
        params: { id: '999' },
        body: { firstName: 'Test' }
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Client non trouvé'
      })
    })
  })

  // -----------------------------------------
  // DELETE /api/clients/:id ([id].delete.ts)
  // -----------------------------------------
  describe('DELETE /api/clients/:id ([id].delete)', () => {
    it('supprime et retourne { success, message }', async () => {
      currentDb = createDeleteChain([{ id: 1 }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/[id].delete')).default as any
      const event = createMockEvent({ params: { id: '1' } })

      const res = await handler(event)

      expect(res.success).toBe(true)
      expect(res.message).toBe('Client supprimé avec succès')
      expect(currentDb.delete).toHaveBeenCalled()
    })

    it('throw 404 si client inexistant', async () => {
      currentDb = createDeleteChain([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/clients/[id].delete')).default as any
      const event = createMockEvent({ params: { id: '999' } })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Client non trouvé'
      })
    })
  })
})
