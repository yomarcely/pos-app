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
  establishments: { tenantId: 'establishments.tenantId', isActive: 'establishments.isActive' },
  registers: { tenantId: 'registers.tenantId', isActive: 'registers.isActive' },
  sellers: { tenantId: 'sellers.tenantId', isActive: 'sellers.isActive' },
  taxRates: { tenantId: 'taxRates.tenantId', isArchived: 'taxRates.isArchived' },
  products: { tenantId: 'products.tenantId' },
}))

/**
 * Le handler lance 5 select().from().where() en parallèle via Promise.all.
 * Ordre : establishments, registers, sellers, taxRates, products.
 */
function createCountDb(counts: [number, number, number, number, number]) {
  let callIdx = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => {
      const idx = callIdx
      callIdx += 1
      return Promise.resolve([{ c: counts[idx] ?? 0 }])
    }),
  }
  return chain
}

describe('GET /api/onboarding/status', () => {
  beforeEach(() => { vi.resetModules() })

  it('retourne isComplete=false et progress 0/5 quand aucune entité', async () => {
    currentDb = createCountDb([0, 0, 0, 0, 0])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/status.get')).default as any

    const res = await handler(createMockEvent())

    expect(res).toEqual({
      hasEstablishment: false,
      hasRegister: false,
      hasSeller: false,
      hasTaxRate: false,
      hasProduct: false,
      isComplete: false,
      progress: { done: 0, total: 5 },
    })
  })

  it('retourne isComplete=true quand les 5 entités sont présentes', async () => {
    currentDb = createCountDb([1, 1, 1, 3, 5])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/status.get')).default as any

    const res = await handler(createMockEvent())

    expect(res.isComplete).toBe(true)
    expect(res.progress).toEqual({ done: 5, total: 5 })
    expect(res.hasEstablishment).toBe(true)
    expect(res.hasRegister).toBe(true)
    expect(res.hasSeller).toBe(true)
    expect(res.hasTaxRate).toBe(true)
    expect(res.hasProduct).toBe(true)
  })

  it('détecte l\'absence de caisse même si tout le reste est présent', async () => {
    currentDb = createCountDb([1, 0, 1, 3, 5])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/status.get')).default as any

    const res = await handler(createMockEvent())

    expect(res.hasRegister).toBe(false)
    expect(res.isComplete).toBe(false)
    expect(res.progress).toEqual({ done: 4, total: 5 })
  })

  it('compte correctement un état partiel (vendeurs + TVA seedés, pas d\'établissement, caisse ni produit)', async () => {
    currentDb = createCountDb([0, 0, 1, 3, 0])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/onboarding/status.get')).default as any

    const res = await handler(createMockEvent())

    expect(res.hasSeller).toBe(true)
    expect(res.hasTaxRate).toBe(true)
    expect(res.hasEstablishment).toBe(false)
    expect(res.hasRegister).toBe(false)
    expect(res.hasProduct).toBe(false)
    expect(res.isComplete).toBe(false)
    expect(res.progress).toEqual({ done: 2, total: 5 })
  })
})
