import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../../setup'

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id'),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const logEntityCreation = vi.fn(async (..._args: unknown[]) => undefined)
vi.mock('~/server/utils/audit', () => ({
  logEntityCreation: (...args: unknown[]) => logEntityCreation(...args),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb },
}))

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  count: () => ({ type: 'count' }),
}))

vi.mock('~/server/database/schema', () => ({
  sellers: { id: 'sellers.id', tenantId: 'sellers.tenantId', isActive: 'sellers.isActive' },
  taxRates: { tenantId: 'taxRates.tenantId' },
  establishments: { id: 'establishments.id', tenantId: 'establishments.tenantId', isActive: 'establishments.isActive' },
  sellerEstablishments: { sellerId: 'se.sellerId', establishmentId: 'se.establishmentId', tenantId: 'se.tenantId' },
}))

/**
 * Mock DB orchestré par une queue de réponses pour les SELECTs successifs.
 *
 * Ordre des SELECTs émis par le handler (dans cet ordre exact) :
 *   1. count(sellers)
 *   2. count(taxRates)
 *   3. select sellers actifs (phase rattachement)
 *   4. select établissements actifs (phase rattachement)
 *   5. select liens existants sellerEstablishments (phase rattachement)
 *
 * `insertedIds` est consommé dans l'ordre par les `.returning()` (sellers + taxRates).
 * L'insert bulk de sellerEstablishments ne consomme PAS d'id (no returning).
 */
function createSeedDb(responses: unknown[][], insertedIds: number[]) {
  let respIdx = 0
  let insertIdx = 0
  const inserts: Array<{ table: unknown; values: unknown }> = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => {
      const r = responses[respIdx] ?? []
      respIdx += 1
      return Promise.resolve(r)
    }),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: unknown) => {
        inserts.push({ table, values: vals })
        return {
          returning: vi.fn(() => {
            const id = insertedIds[insertIdx] ?? insertIdx + 1
            insertIdx += 1
            const base = typeof vals === 'object' && vals !== null && !Array.isArray(vals)
              ? (vals as Record<string, unknown>)
              : {}
            return Promise.resolve([{ id, ...base }])
          }),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject),
        }
      }),
    })),
  }
  return { chain, inserts }
}

describe('POST /api/onboarding/seed', () => {
  beforeEach(() => {
    vi.resetModules()
    logEntityCreation.mockClear()
  })

  it('crée 1 vendeur + 3 TVA quand la DB est vide (aucun établissement)', async () => {
    const { chain, inserts } = createSeedDb(
      [
        [{ c: 0 }],  // count sellers
        [{ c: 0 }],  // count taxRates
        [{ id: 42 }], // select sellers actifs (le seller créé)
        [],          // select établissements actifs (aucun)
        [],          // select sellerEstablishments
      ],
      [42, 100, 101, 102],
    )
    currentDb = chain
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/seed.post')).default as any

    const res = await handler(createMockEvent({
      auth: { user: { id: 'u1', email: 'jane@acme.io', user_metadata: { name: 'Jane Doe' } } as never },
    }))

    expect(res.success).toBe(true)
    expect(res.created).toEqual({ seller: true, taxRates: 3, sellerAttachments: 0 })
    expect(res.alreadySeeded).toBe(false)
    expect(res.errors).toEqual([])

    expect(inserts).toHaveLength(4)
    expect(inserts[0]?.values).toMatchObject({ name: 'Jane Doe', isActive: true })
    expect(inserts[1]?.values).toMatchObject({ name: 'Taux normal 20%', rate: '20.00', code: 'TVA_1', isDefault: true })
    expect(inserts[3]?.values).toMatchObject({ name: 'Taux réduit 5,5%', rate: '5.50', code: 'TVA_3', isDefault: false })
    expect(logEntityCreation).toHaveBeenCalledTimes(4)
  })

  it('rattache le vendeur seedé quand un établissement existe déjà', async () => {
    const { chain, inserts } = createSeedDb(
      [
        [{ c: 1 }],                              // count sellers (déjà 1)
        [{ c: 3 }],                              // count taxRates (déjà 3)
        [{ id: 42 }],                            // select sellers actifs
        [{ id: 7 }],                             // select établissements actifs
        [],                                      // select sellerEstablishments (aucun lien)
      ],
      [],
    )
    currentDb = chain
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/seed.post')).default as any

    const res = await handler(createMockEvent({
      auth: { user: { id: 'u1', email: 'jane@acme.io' } as never },
    }))

    expect(res.success).toBe(true)
    expect(res.created).toEqual({ seller: false, taxRates: 0, sellerAttachments: 1 })
    expect(res.alreadySeeded).toBe(false)

    // 1 insert bulk pour le rattachement
    expect(inserts).toHaveLength(1)
    expect(inserts[0]?.values).toEqual([
      { tenantId: 'test-tenant-id', sellerId: 42, establishmentId: 7 },
    ])
  })

  it('est totalement idempotent : déjà seedé + déjà rattaché', async () => {
    const { chain, inserts } = createSeedDb(
      [
        [{ c: 1 }],
        [{ c: 3 }],
        [{ id: 42 }],
        [{ id: 7 }],
        [{ sellerId: 42, establishmentId: 7 }], // lien déjà présent
      ],
      [],
    )
    currentDb = chain
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/seed.post')).default as any

    const res = await handler(createMockEvent({
      auth: { user: { id: 'u1', email: 'jane@acme.io' } as never },
    }))

    expect(res.success).toBe(true)
    expect(res.created).toEqual({ seller: false, taxRates: 0, sellerAttachments: 0 })
    expect(res.alreadySeeded).toBe(true)
    expect(inserts).toHaveLength(0)
    expect(logEntityCreation).not.toHaveBeenCalled()
  })

  it('rattache 2 vendeurs à 2 établissements (produit cartésien)', async () => {
    const { chain, inserts } = createSeedDb(
      [
        [{ c: 2 }],
        [{ c: 3 }],
        [{ id: 42 }, { id: 43 }],                                // 2 sellers
        [{ id: 7 }, { id: 8 }],                                  // 2 etablissements
        [{ sellerId: 42, establishmentId: 7 }],                  // 1 seul lien existant
      ],
      [],
    )
    currentDb = chain
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/seed.post')).default as any

    const res = await handler(createMockEvent({
      auth: { user: { id: 'u1', email: 'jane@acme.io' } as never },
    }))

    // 3 liens manquants : (42,8), (43,7), (43,8)
    expect(res.created.sellerAttachments).toBe(3)
    expect(inserts).toHaveLength(1)
    expect((inserts[0]?.values as unknown[])).toHaveLength(3)
  })

  it('fallback nom : email avant @ si pas de user_metadata.name', async () => {
    const { chain, inserts } = createSeedDb(
      [
        [{ c: 0 }],
        [{ c: 1 }],       // tax rates déjà présents
        [{ id: 42 }],
        [],
        [],
      ],
      [42],
    )
    currentDb = chain
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/seed.post')).default as any

    await handler(createMockEvent({
      auth: { user: { id: 'u1', email: 'bob@acme.io' } as never },
    }))

    expect(inserts[0]?.values).toMatchObject({ name: 'bob' })
  })
})
