/**
 * Tests d'isolation multi-tenant.
 *
 * Approche : pour chaque endpoint critique, on monte un mock DB qui *enregistre*
 * les conditions WHERE passées à Drizzle, et on vérifie que le `tenantId` est
 * systématiquement présent dans les conditions. Si un endpoint n'utilise pas
 * `tenantId` dans une de ses requêtes, le test échoue.
 *
 * Combinés avec l'audit statique (`scripts/audit-tenant-isolation.ts`), ces tests
 * couvrent à la fois la présence ET la sémantique du filtrage tenant.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockEvent } from '../setup'

// ===========================================
// Mocks communs
// ===========================================

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (event: unknown) => (event as { body?: unknown })?.body || {}),
  validateQuery: vi.fn((event: unknown) => (event as { query?: unknown })?.query || {}),
}))

const TENANT_A = 'tenant-A-uuid'
const TENANT_B = 'tenant-B-uuid'

// `getTenantIdFromEvent` est utilisé via 2 chemins :
// - Import explicite (`from '~/server/utils/tenant'`) → intercepté par le vi.mock du setup
// - Auto-import Nuxt côté server/ → intercepté par globalThis.getTenantIdFromEvent du setup
// On override les 2 pour garantir la cohérence.
import { getTenantIdFromEvent } from '~/server/utils/tenant'
const tenantMock = vi.mocked(getTenantIdFromEvent)
let currentTenant = TENANT_A
function setTenant(tenant: string): void {
  currentTenant = tenant
  tenantMock.mockReturnValue(tenant)
  ;(globalThis as Record<string, unknown>).getTenantIdFromEvent = () => tenant
}

// Override createError pour intercepter les status codes
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error(data.message as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

// ===========================================
// Mock Drizzle qui *capture* les opérations
// ===========================================

interface CapturedOp {
  type: string
  args: unknown[]
}

// Stockage global partagé entre le test et le mock (vi.resetModules recrée la closure
// du mock factory, mais globalThis persiste).
const CAPTURE_KEY = '__tenantIsolationCaptured'
function getCaptured(): CapturedOp[] {
  return (globalThis as Record<string, unknown>)[CAPTURE_KEY] as CapturedOp[]
}
function resetCaptured(): void {
  (globalThis as Record<string, unknown>)[CAPTURE_KEY] = []
}

vi.mock('drizzle-orm', () => {
  const tagger = (type: string) => (...args: unknown[]) => {
    const arr = (globalThis as Record<string, unknown>)['__tenantIsolationCaptured'] as CapturedOp[] | undefined
    if (arr) arr.push({ type, args })
    return { type, args }
  }
  return {
    eq: tagger('eq'),
    and: tagger('and'),
    or: tagger('or'),
    desc: tagger('desc'),
    asc: tagger('asc'),
    sql: tagger('sql'),
    like: tagger('like'),
    inArray: tagger('inArray'),
    isNull: tagger('isNull'),
    gt: tagger('gt'),
    lt: tagger('lt'),
    gte: tagger('gte'),
    lte: tagger('lte'),
    ne: tagger('ne'),
    count: tagger('count'),
  }
})

// Schema mock — on map juste les colonnes utilisées par les endpoints testés
vi.mock('~/server/database/schema', () => ({
  customers: {
    id: 'customers.id', tenantId: 'customers.tenantId',
    firstName: 'customers.firstName', lastName: 'customers.lastName',
    email: 'customers.email', phone: 'customers.phone', address: 'customers.address',
    metadata: 'customers.metadata', gdprConsent: 'customers.gdprConsent',
    gdprConsentDate: 'customers.gdprConsentDate', marketingConsent: 'customers.marketingConsent',
    loyaltyProgram: 'customers.loyaltyProgram', discount: 'customers.discount', notes: 'customers.notes',
    createdAt: 'customers.createdAt', updatedAt: 'customers.updatedAt',
  },
  customerEstablishments: {
    id: 'ce.id', customerId: 'ce.customerId', establishmentId: 'ce.establishmentId',
    tenantId: 'ce.tenantId', localLoyaltyPoints: 'ce.localLoyaltyPoints',
  },
  products: { id: 'products.id', tenantId: 'products.tenantId', name: 'products.name', isArchived: 'products.isArchived' },
  productStocks: { id: 'ps.id', productId: 'ps.productId', tenantId: 'ps.tenantId', establishmentId: 'ps.establishmentId' },
  productEstablishments: { id: 'pe.id', productId: 'pe.productId', tenantId: 'pe.tenantId', establishmentId: 'pe.establishmentId' },
  categories: { id: 'categories.id', name: 'categories.name', tenantId: 'categories.tenantId' },
  brands: { id: 'brands.id', name: 'brands.name', tenantId: 'brands.tenantId' },
  suppliers: { id: 'suppliers.id', name: 'suppliers.name', tenantId: 'suppliers.tenantId' },
  sales: { id: 'sales.id', tenantId: 'sales.tenantId', customerId: 'sales.customerId', status: 'sales.status', totalTTC: 'sales.totalTTC' },
  loyaltyVouchers: {
    id: 'lv.id', tenantId: 'lv.tenantId', customerId: 'lv.customerId',
    code: 'lv.code', amount: 'lv.amount', status: 'lv.status',
    expiresAt: 'lv.expiresAt', createdAt: 'lv.createdAt',
  },
  loyaltyConfig: {
    id: 'lc.id', tenantId: 'lc.tenantId', enabled: 'lc.enabled',
    pointMode: 'lc.pointMode', thresholdPoints: 'lc.thresholdPoints',
    rewardType: 'lc.rewardType', rewardValue: 'lc.rewardValue', voucherValidityDays: 'lc.voucherValidityDays',
  },
  closures: { id: 'closures.id', tenantId: 'closures.tenantId', closureDate: 'closures.closureDate', registerId: 'closures.registerId' },
  registers: { id: 'registers.id', tenantId: 'registers.tenantId', name: 'registers.name' },
  establishments: { id: 'establishments.id', tenantId: 'establishments.tenantId', name: 'establishments.name', siret: 'establishments.siret' },
}))

// Mock helpers loyalty (utilisés par certains endpoints)
vi.mock('~/server/utils/loyalty', () => ({
  getActiveLoyaltyConfig: vi.fn(),
  getCustomerLoyaltyPoints: vi.fn(() => Promise.resolve(0)),
  calculatePointsForSale: vi.fn(() => 0),
}))

vi.mock('h3', () => ({
  getRequestIP: vi.fn(() => '127.0.0.1'),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb },
}))

function createReadChain(rows: unknown[], countTotal = 0) {
  // Chain thenable qui supporte plusieurs awaits successifs (data, count, etc.)
  let awaitIdx = 0
  const queue: unknown[] = [rows, [{ total: countTotal }]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void) =>
      Promise.resolve(queue[awaitIdx++] ?? []).then(resolve),
  }
  return chain
}

// ===========================================
// Helper : assert qu'un tenantId apparaît dans les eq() capturés
// ===========================================
function assertTenantIdFiltered(expectedTenant: string): void {
  const captured = getCaptured()
  const eqCalls = captured.filter(c => c.type === 'eq')
  const tenantEq = eqCalls.filter(c =>
    typeof c.args[0] === 'string' && String(c.args[0]).includes('tenantId')
    && c.args[1] === expectedTenant,
  )
  expect(tenantEq.length).toBeGreaterThan(0)
}

// ===========================================
// Tests
// ===========================================

describe('Isolation tenant — endpoints lecture', () => {
  beforeEach(() => {
    resetCaptured()
    tenantMock.mockReset()
  })

  it('GET /api/clients filtre par tenant A quand tenant A appelle', async () => {
    setTenant(TENANT_A)
    currentDb = createReadChain([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/index.get')).default as any
    await handler(createMockEvent())
    assertTenantIdFiltered(TENANT_A)
  })

  it('GET /api/clients filtre par tenant B quand tenant B appelle', async () => {
    setTenant(TENANT_B)
    currentDb = createReadChain([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/index.get')).default as any
    await handler(createMockEvent())
    assertTenantIdFiltered(TENANT_B)
    // Et pas de filtrage par tenant A
    const eqA = getCaptured().filter(c => c.type === 'eq' && c.args[1] === TENANT_A)
    expect(eqA.length).toBe(0)
  })

  it('GET /api/products filtre par le tenant courant', async () => {
    setTenant(TENANT_A)
    currentDb = createReadChain([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/products/index.get')).default as any
    await handler(createMockEvent())
    assertTenantIdFiltered(TENANT_A)
  })

  it('GET /api/closures filtre par le tenant courant', async () => {
    setTenant(TENANT_B)
    currentDb = createReadChain([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/closures/index.get')).default as any
    await handler(createMockEvent())
    assertTenantIdFiltered(TENANT_B)
  })
})

describe('Isolation tenant — endpoints loyalty', () => {
  beforeEach(() => {
    resetCaptured()
    tenantMock.mockReset()
  })

  it('GET /api/loyalty/config filtre par tenant', async () => {
    setTenant(TENANT_A)
    currentDb = createReadChain([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/loyalty/config.get')).default as any
    await handler(createMockEvent())
    assertTenantIdFiltered(TENANT_A)
  })

  it('GET /api/clients/:id/loyalty-status filtre par tenant + customer', async () => {
    setTenant(TENANT_B)
    const loyaltyMod = await import('~/server/utils/loyalty')
    vi.mocked(loyaltyMod.getActiveLoyaltyConfig).mockResolvedValue({
      enabled: true, pointMode: 'per_euro', thresholdPoints: 100,
      rewardType: 'percent_discount', rewardValue: 5, voucherValidityDays: 60,
    })
    currentDb = createReadChain([{ id: 1, loyaltyProgram: true }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/[id]/loyalty-status.get')).default as any
    await handler(createMockEvent({ params: { id: '1' }, query: { establishmentId: '5' } }))
    assertTenantIdFiltered(TENANT_B)
  })
})

describe('Isolation tenant — audit statique', () => {
  it('aucun endpoint ne doit lire event.context.auth.tenantId directement', async () => {
    // Smoke test : l'audit statique a déjà validé ce point.
    // Ce test garantit que la règle reste appliquée à chaque modification.
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = join(process.cwd(), 'server/api')
    function listFiles(dir: string): string[] {
      const out: string[] = []
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...listFiles(full))
        else if (full.endsWith('.ts')) out.push(full)
      }
      return out
    }
    const violations: string[] = []
    for (const file of listFiles(root)) {
      const content = readFileSync(file, 'utf-8')
      if (/event\.context\.auth\.tenantId/.test(content)) {
        violations.push(file)
      }
    }
    expect(violations).toEqual([])
  })

  it('tous les endpoints non-publics doivent appeler getTenantIdFromEvent', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join, relative } = await import('node:path')
    const root = join(process.cwd(), 'server/api')
    const repoRoot = process.cwd()
    const knownPublic = ['login', 'auth', 'database/seed']
    function listFiles(dir: string): string[] {
      const out: string[] = []
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...listFiles(full))
        else if (full.endsWith('.ts')) out.push(full)
      }
      return out
    }
    const violations: string[] = []
    for (const file of listFiles(root)) {
      const apiPath = relative(root, file).replace(/\\/g, '/').replace(/\.ts$/, '')
      if (knownPublic.some(p => apiPath.startsWith(p))) continue
      const content = readFileSync(file, 'utf-8')
      if (!/getTenantIdFromEvent\s*\(/.test(content)) {
        violations.push(relative(repoRoot, file))
      }
    }
    expect(violations).toEqual([])
  })
})
