import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

// ============================================================================
// Test de concurrence — server/api/movements/create.post.ts
// ----------------------------------------------------------------------------
// Objectif : deux create-movement simultanés (Promise.all) sur le MÊME
// produit/établissement doivent produire un stock final correct ET une trace
// d'audit oldStock/newStock cohérente (chaînée) pour les deux mouvements.
//
// Le correctif repose sur pg_advisory_xact_lock(establishmentId) posé en tête de
// transaction. On simule ici :
//   - un mutex par clé de verrou (sérialise les transactions concurrentes),
//   - l'UPDATE atomique `stock = COALESCE(stock,0) + delta` + RETURNING stock,
//   - le read-modify-write JSONB des variations,
// avec de vraies frontières `await` pour que les deux branches de Promise.all
// s'entrelacent réellement (sans verrou, ce test échouerait).
// ============================================================================

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id')
}))

vi.mock('~/server/utils/roles', () => ({
  assertRole: vi.fn(),
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

let movementSeq = 0
vi.mock('~/server/utils/createMovement', () => ({
  createMovement: vi.fn(async (type: string, comment?: string) => {
    // yield pour laisser l'autre transaction progresser
    await Promise.resolve()
    movementSeq += 1
    return { id: movementSeq, movementNumber: `MOV-${String(movementSeq).padStart(3, '0')}`, type, comment }
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb }
}))

// `sql` renvoie ses arguments bruts : [strings, ...values]. On y retrouve la clé
// de verrou (nombre) et le delta de l'UPDATE atomique.
vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
}))

vi.mock('~/server/database/schema', () => ({
  products: { __table: 'products', id: 'products.id' },
  stockMovements: { __table: 'stockMovements' },
  productStocks: { __table: 'productStocks', id: 'ps.id', stock: 'ps.stock' },
}))

// ---------------------------------------------------------------------------
// Fake DB stateful avec mutex par clé de verrou
// ---------------------------------------------------------------------------
interface VarStock { variationId: string; stock: number }
interface AuditRow { productId: number; variation: string | null; oldStock: number; newStock: number; quantityDelta: number }

function createStatefulDb(initial: { productId: number; establishmentId: number; stock: number; stockByVariation?: VarStock[] }) {
  const product = { id: initial.productId, name: 'Produit', stock: 0, stockByVariation: null }
  const psRow = {
    id: 1,
    tenantId: 'test-tenant-id',
    productId: initial.productId,
    establishmentId: initial.establishmentId,
    stock: initial.stock,
    stockByVariation: (initial.stockByVariation ?? []) as VarStock[],
  }
  const audit: AuditRow[] = []

  // mutex par clé
  const locks = new Map<number, Promise<void>>()
  async function acquire(key: number): Promise<() => void> {
    const prev = locks.get(key) ?? Promise.resolve()
    let release!: () => void
    const held = new Promise<void>((res) => { release = res })
    locks.set(key, prev.then(() => held))
    await prev // bloque tant que le détenteur précédent n'a pas relâché
    return release
  }

  function makeTx() {
    const releases: Array<() => void> = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx: any = {
      execute: async (arg: unknown[]) => {
        // détecte pg_advisory_xact_lock(<key>) : la clé est l'unique nombre passé
        const key = (arg as unknown[]).find((a) => typeof a === 'number') as number | undefined
        if (typeof key === 'number') {
          releases.push(await acquire(key))
        }
      },

      select: () => {
        let table: string
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          from: (t: any) => { table = t.__table; return chain() },
        }
        function chain() {
          return {
            where: () => ({
              limit: async () => {
                await Promise.resolve()
                if (table === 'products') return [product]
                if (table === 'productStocks') return [psRow]
                return []
              },
            }),
          }
        }
      },

      update: () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: (values: any) => ({
          where: () => {
            const apply = async () => {
              await Promise.resolve()
              if (Array.isArray(values.stockByVariation)) {
                psRow.stockByVariation = values.stockByVariation
                return psRow.stock
              }
              // stock = COALESCE(stock,0) + delta  → delta = dernier nombre du fragment sql
              const frag = values.stock as unknown[]
              const delta = frag.filter((x) => typeof x === 'number').pop() as number
              psRow.stock = (psRow.stock ?? 0) + delta
              return psRow.stock
            }
            return {
              returning: async () => [{ stock: await apply() }],
              then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
                apply().then(() => resolve(undefined), reject),
            }
          },
        }),
      }),

      insert: () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        values: (v: any) => ({
          then: (resolve: (x: unknown) => void, reject?: (e: unknown) => void) =>
            (async () => {
              await Promise.resolve()
              if ('reason' in v) {
                audit.push({
                  productId: v.productId, variation: v.variation,
                  oldStock: v.oldStock, newStock: v.newStock, quantityDelta: v.quantity,
                })
              }
            })().then(resolve, reject),
        }),
      }),
      __release: () => { releases.forEach((r) => r()) },
    }
    return tx
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const tx = makeTx()
      try { return await fn(tx) }
      finally { tx.__release() }
    },
    __state: psRow,
    __audit: audit,
  }
}

async function runTwo(bodyA: unknown, bodyB: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (await import('~/server/api/movements/create.post')).default as any
  return Promise.all([
    handler(createMockEvent({ body: bodyA })),
    handler(createMockEvent({ body: bodyB })),
  ])
}

describe('API /api/movements/create — concurrence (verrou par établissement)', () => {
  beforeEach(() => { vi.resetModules(); movementSeq = 0 })

  it("mode 'add' : deux ajustements simultanés → stock final correct + audit chaîné", async () => {
    currentDb = createStatefulDb({ productId: 1, establishmentId: 5, stock: 10 })
    const item = { productId: 1, quantity: 5, adjustmentType: 'add' }
    await runTwo(
      { type: 'reception', establishmentId: 5, items: [item] },
      { type: 'reception', establishmentId: 5, items: [item] },
    )

    // 10 + 5 + 5 = 20
    expect(currentDb.__state.stock).toBe(20)
    const pairs = currentDb.__audit
      .map((a: AuditRow): [number, number] => [a.oldStock, a.newStock])
      .sort((x: [number, number], y: [number, number]) => x[0] - y[0])
    // chaînage : (10→15) puis (15→20), aucun avant/après incohérent
    expect(pairs).toEqual([[10, 15], [15, 20]])
  })

  it("mode 'set' + 'add' simultanés : le set atteint la valeur absolue, stock final cohérent", async () => {
    currentDb = createStatefulDb({ productId: 1, establishmentId: 5, stock: 10 })
    await runTwo(
      { type: 'adjustment', establishmentId: 5, items: [{ productId: 1, quantity: 100, adjustmentType: 'set' }] },
      { type: 'reception', establishmentId: 5, items: [{ productId: 1, quantity: 5, adjustmentType: 'add' }] },
    )

    // set→100 et add→+5, sérialisés : le stock final vaut 105 quel que soit l'ordre
    // (jamais 110 : le "set" est calculé sous verrou, pas sur une lecture périmée).
    expect(currentDb.__state.stock).toBe(105)
    // audit chaîné : le newStock de l'un est l'oldStock de l'autre
    const rows = [...currentDb.__audit].sort((a: AuditRow, b: AuditRow) => a.oldStock - b.oldStock)
    expect(rows[0].oldStock).toBe(10)
    expect(rows[1].oldStock).toBe(rows[0].newStock)
    expect(rows[1].newStock).toBe(105)
    // chaque ligne d'audit est cohérente : newStock = oldStock + quantityDelta
    for (const r of rows) expect(r.newStock).toBe(r.oldStock + r.quantityDelta)
  })

  it("variation : deux 'add' simultanés sur la même variation → pas de lost update", async () => {
    currentDb = createStatefulDb({
      productId: 1, establishmentId: 5, stock: 0,
      stockByVariation: [{ variationId: 'red', stock: 10 }],
    })
    const item = { productId: 1, variation: 'red', quantity: 5, adjustmentType: 'add' }
    await runTwo(
      { type: 'reception', establishmentId: 5, items: [item] },
      { type: 'reception', establishmentId: 5, items: [item] },
    )

    const red = (currentDb.__state.stockByVariation as VarStock[]).find(v => v.variationId === 'red')
    // 10 + 5 + 5 = 20 (aucun écrasement)
    expect(red?.stock).toBe(20)
    const pairs = currentDb.__audit
      .map((a: AuditRow): [number, number] => [a.oldStock, a.newStock])
      .sort((x: [number, number], y: [number, number]) => x[0] - y[0])
    expect(pairs).toEqual([[10, 15], [15, 20]])
  })
})
