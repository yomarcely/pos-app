import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

// Override createError pour récupérer le statusCode dans les erreurs lancées
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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

// Capture des conditions passées à where()
const whereConditions: unknown[] = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let movementsResult: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let linesResult: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nextSelectIsLines = false

vi.mock('~/server/database/connection', () => {
  const buildMovementsChain = () => ({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn((cond: unknown) => {
            whereConditions.push(cond)
            return {
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve(movementsResult)),
              })),
            }
          }),
        })),
      })),
    })),
  })

  const buildLinesChain = () => ({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn((cond: unknown) => {
          whereConditions.push(cond)
          return Promise.resolve(linesResult)
        }),
      })),
    })),
  })

  return {
    db: {
      select: vi.fn(() => {
        const chain = nextSelectIsLines ? buildLinesChain() : buildMovementsChain()
        nextSelectIsLines = !nextSelectIsLines
        return chain
      }),
    },
  }
})

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (col: unknown) => ({ type: 'desc', col }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lte: (...args: unknown[]) => ({ type: 'lte', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  isNull: (col: unknown) => ({ type: 'isNull', col }),
  isNotNull: (col: unknown) => ({ type: 'isNotNull', col }),
}))

vi.mock('~/server/database/schema', () => ({
  movements: {
    id: 'movements.id',
    tenantId: 'movements.tenantId',
    movementNumber: 'movements.movementNumber',
    type: 'movements.type',
    comment: 'movements.comment',
    supplierId: 'movements.supplierId',
    deliveryNoteNumber: 'movements.deliveryNoteNumber',
    establishmentId: 'movements.establishmentId',
    userId: 'movements.userId',
    createdAt: 'movements.createdAt',
  },
  stockMovements: {
    id: 'stockMovements.id',
    movementId: 'stockMovements.movementId',
    productId: 'stockMovements.productId',
    variation: 'stockMovements.variation',
    quantity: 'stockMovements.quantity',
    oldStock: 'stockMovements.oldStock',
    newStock: 'stockMovements.newStock',
    reason: 'stockMovements.reason',
    tenantId: 'stockMovements.tenantId',
  },
  products: {
    id: 'products.id',
    name: 'products.name',
  },
  suppliers: {
    id: 'suppliers.id',
    name: 'suppliers.name',
  },
  establishments: {
    id: 'establishments.id',
    name: 'establishments.name',
  },
}))

function flattenConditions(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return []
  const n = node as { type?: string; args?: unknown[] }
  if (n.type === 'and' && Array.isArray(n.args)) {
    return n.args.flatMap(flattenConditions)
  }
  return [n]
}

describe('GET /api/movements/history', () => {
  beforeEach(() => {
    vi.resetModules()
    whereConditions.length = 0
    movementsResult = []
    linesResult = []
    nextSelectIsLines = false
  })

  it('renvoie un tableau vide si aucun mouvement', async () => {
    movementsResult = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/history.get')).default as any

    const res = await handler(createMockEvent({ query: {} }))

    expect(res.success).toBe(true)
    expect(res.movements).toEqual([])
    expect(res.count).toBe(0)
  })

  it('groupe les lignes par mouvement et calcule itemCount/totalQuantity', async () => {
    movementsResult = [
      {
        id: 10,
        movementNumber: 'REC-000010',
        type: 'reception',
        comment: 'Livraison',
        supplierId: 5,
        supplierName: 'Fournisseur A',
        deliveryNoteNumber: 'BL-001',
        establishmentId: 1,
        establishmentName: 'Magasin Principal',
        userId: null,
        createdAt: '2026-05-01T10:00:00.000Z',
      },
    ]
    linesResult = [
      {
        id: 100, movementId: 10, productId: 1, productName: 'Produit A',
        variation: null, quantity: 5, oldStock: 0, newStock: 5, reason: 'reception',
      },
      {
        id: 101, movementId: 10, productId: 2, productName: 'Produit B',
        variation: null, quantity: -2, oldStock: 10, newStock: 8, reason: 'reception',
      },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/history.get')).default as any

    const res = await handler(createMockEvent({ query: {} }))

    expect(res.success).toBe(true)
    expect(res.movements).toHaveLength(1)
    expect(res.movements[0].itemCount).toBe(2)
    expect(res.movements[0].totalQuantity).toBe(7) // |5| + |-2| = 7
    expect(res.movements[0].items[0].productName).toBe('Produit A')
    expect(res.movements[0].supplierName).toBe('Fournisseur A')
  })

  it('applique le filtre type=reception-supplier (eq reception + isNotNull supplier)', async () => {
    movementsResult = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/history.get')).default as any

    await handler(createMockEvent({ query: { type: 'reception-supplier' } }))

    const flat = flattenConditions(whereConditions[0])
    const types = flat.map((c) => (c as { type?: string }).type || '')
    expect(types).toContain('eq')
    expect(types).toContain('isNotNull')
  })

  it('applique le filtre type=reception-free (eq reception + isNull supplier)', async () => {
    movementsResult = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/history.get')).default as any

    await handler(createMockEvent({ query: { type: 'reception-free' } }))

    const flat = flattenConditions(whereConditions[0])
    const types = flat.map((c) => (c as { type?: string }).type || '')
    expect(types).toContain('isNull')
  })

  it('applique le filtre de période (gte/lte)', async () => {
    movementsResult = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/history.get')).default as any

    await handler(createMockEvent({ query: { dateFrom: '2026-05-01', dateTo: '2026-05-30' } }))

    const flat = flattenConditions(whereConditions[0])
    const types = flat.map((c) => (c as { type?: string }).type || '')
    expect(types).toContain('gte')
    expect(types).toContain('lte')
  })

  it('rejette les types invalides en ignorant le filtre', async () => {
    movementsResult = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/history.get')).default as any

    await handler(createMockEvent({ query: { type: 'invalid-type' } }))

    const flat = flattenConditions(whereConditions[0])
    // Seul le tenant filter doit être présent
    const eqCount = flat.filter((c) => (c as { type?: string }).type === 'eq').length
    expect(eqCount).toBe(1)
  })

  it('applique le filtre supplierId (eq supplier)', async () => {
    movementsResult = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/movements/history.get')).default as any

    await handler(createMockEvent({ query: { supplierId: '42' } }))

    const flat = flattenConditions(whereConditions[0])
    // tenant + supplierId → deux eq
    const eqArgs = flat
      .filter((c) => (c as { type?: string }).type === 'eq')
      .flatMap((c) => (c as { args?: unknown[] }).args ?? [])
    expect(eqArgs).toContain(42)
  })
})
