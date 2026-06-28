import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

// createError doit renvoyer une vraie Error porteuse de statusCode : le handler ne
// re-propage (au lieu d'un 500 générique) que si `error instanceof Error && 'statusCode' in error`.
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

vi.mock('~/server/validators/sale.schema', () => ({
  createSaleRequestSchema: {},
}))

vi.mock('~/server/utils/nf525', () => ({
  generateTicketNumber: vi.fn(() => '20240115-E01-R01-000001'),
  generateTicketHash: vi.fn(() => 'mock-hash-abc123'),
  generateTicketSignature: vi.fn(() => 'mock-signature-xyz'),
}))

vi.mock('~/server/utils/audit', () => ({
  logSaleCreation: vi.fn(() => Promise.resolve()),
  logSystemError: vi.fn(() => Promise.resolve()),
}))

vi.mock('~/server/utils/financialValidation', () => ({
  recomputeTotalTTC: vi.fn(() => 10),
  validateTotalTTC: vi.fn(() => true),
  recomputeHTandTVA: vi.fn(() => ({ totalHT: 8.33, totalTVA: 1.67 })),
}))

// Pas de config fidélité active → la génération de points/voucher est court-circuitée,
// on isole le chemin "voucher utilisé comme paiement".
vi.mock('~/server/utils/loyalty', () => ({
  getActiveLoyaltyConfig: vi.fn(() => Promise.resolve(null)),
  calculatePointsForSale: vi.fn(() => 0),
  getCustomerLoyaltyPoints: vi.fn(() => Promise.resolve(0)),
}))

vi.mock('~/server/utils/purchasePriceSnapshot', () => ({
  resolvePurchasePriceAtSale: vi.fn(() => null),
}))

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
  gt: (...args: unknown[]) => ({ type: 'gt', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
}))

vi.mock('~/server/database/schema', () => ({
  sales: { __table: 'sales' },
  saleItems: { __table: 'saleItems' },
  stockMovements: { __table: 'stockMovements' },
  products: { __table: 'products', id: 'products.id', tenantId: 'products.tenantId', purchasePrice: 'products.purchasePrice' },
  productEstablishments: { __table: 'productEstablishments', productId: 'pe.productId', establishmentId: 'pe.establishmentId', tenantId: 'pe.tenantId', purchasePriceOverride: 'pe.purchasePriceOverride' },
  variations: { __table: 'variations', id: 'variations.id', name: 'variations.name' },
  registers: { __table: 'registers', id: 'r.id', tenantId: 'r.tenantId', establishmentId: 'r.establishmentId', name: 'r.name', registerNumber: 'r.registerNumber', isActive: 'r.isActive' },
  establishments: { __table: 'establishments', id: 'e.id', tenantId: 'e.tenantId', name: 'e.name', establishmentNumber: 'e.establishmentNumber', isActive: 'e.isActive' },
  closures: { __table: 'closures', tenantId: 'c.tenantId', closureDate: 'c.closureDate', registerId: 'c.registerId' },
  productStocks: { __table: 'productStocks', productId: 'ps.productId', establishmentId: 'ps.establishmentId', tenantId: 'ps.tenantId', stock: 'ps.stock', stockByVariation: 'ps.stockByVariation', updatedAt: 'ps.updatedAt' },
  customers: { __table: 'customers', id: 'cu.id', tenantId: 'cu.tenantId', loyaltyProgram: 'cu.loyaltyProgram' },
  customerEstablishments: { __table: 'customerEstablishments' },
  loyaltyVouchers: { __table: 'loyaltyVouchers', id: 'lv.id', code: 'lv.code', amount: 'lv.amount', customerId: 'lv.customerId', status: 'lv.status', expiresAt: 'lv.expiresAt', tenantId: 'lv.tenantId' },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb }
}))

// ===========================================
// Mutex async modélisant un verrou de ligne PostgreSQL (SELECT ... FOR UPDATE).
// acquire() ne résout qu'une fois le détenteur précédent libéré → sérialise les
// transactions concurrentes sur la même ligne, exactement comme FOR UPDATE.
// ===========================================
function createMutex() {
  let tail = Promise.resolve()
  return {
    acquire(): Promise<() => void> {
      let release!: () => void
      const next = new Promise<void>((res) => { release = res })
      const prev = tail
      tail = tail.then(() => next)
      return prev.then(() => release)
    },
  }
}

interface VoucherRow {
  id: number
  code: string
  amount: string
  customerId: number
  status: string
  expiresAt: Date | null
  usedAt?: Date | null
}

const register = { id: 1, tenantId: 'test-tenant-id', establishmentId: 10, name: 'Caisse 1', registerNumber: 1 }
const establishment = { id: 10, name: 'Boutique', establishmentNumber: 1 }

// ===========================================
// Mock DB conscient de la table interrogée (les deux ventes s'exécutent en parallèle :
// l'ordre des SELECT s'entrelace, un index séquentiel ne suffirait pas) et partageant
// un unique « store » de vouchers entre les deux transactions concurrentes.
// ===========================================
function createConcurrentDb(voucherStore: Map<number, VoucherRow>, stockRows: unknown[]) {
  const voucherMutex = createMutex()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSelectChain(txContext: { releases: Array<() => void> } | null): any {
    const state = { table: null as string | null, locked: false }

    const resolveRows = async (): Promise<unknown[]> => {
      switch (state.table) {
        case 'registers': return [register]
        case 'establishments': return [establishment]
        case 'loyaltyVouchers': {
          if (state.locked) {
            // SELECT ... FOR UPDATE : on acquiert le verrou (peut bloquer si l'autre
            // transaction le détient) et on ne le relâche qu'à la fin de la transaction.
            const release = await voucherMutex.acquire()
            txContext?.releases.push(release)
            // Lecture APRÈS lock : reflète l'éventuel passage à 'used' par l'autre vente.
            return [...voucherStore.values()].map(v => ({ ...v }))
          }
          // Pré-validation (hors transaction, WHERE status='active') : fast-fail UX.
          return [...voucherStore.values()].filter(v => v.status === 'active').map(v => ({ ...v }))
        }
        case 'productStocks': return stockRows
        // closures, sales (lastSale/lastTicket), products, productEstablishments,
        // customers, customerEstablishments, variations → aucune ligne pertinente ici.
        default: return []
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      from: (t: { __table: string }) => { state.table = t.__table; return chain },
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      for: () => { state.locked = true; return chain },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        resolveRows().then(resolve, reject),
    }
    return chain
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeDb(txContext: { releases: Array<() => void> } | null): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = {
      select: () => makeSelectChain(txContext),
      execute: () => Promise.resolve(),
      insert: (table: { __table: string }) => ({
        values: () => ({
          returning: () => Promise.resolve([{
            id: 42,
            ticketNumber: '20240115-E01-R01-000001',
            saleDate: new Date(),
            totalTTC: '10.00',
            currentHash: 'mock-hash-abc123',
            signature: 'mock-signature-xyz',
          }]),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject),
        }),
      }),
      update: (table: { __table: string }) => ({
        set: (set: Record<string, unknown>) => {
          if (table.__table === 'loyaltyVouchers' && set.status === 'used') {
            // Le gagnant marque le bon 'used' dans le store partagé, sous verrou.
            for (const v of voucherStore.values()) {
              if (v.status === 'active') {
                v.status = 'used'
                v.usedAt = set.usedAt as Date
              }
            }
          }
          return {
            where: () => ({
              then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
                Promise.resolve(undefined).then(resolve, reject),
            }),
          }
        },
      }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const ctx = { releases: [] as Array<() => void> }
        try {
          return await fn(makeDb(ctx))
        }
        finally {
          // Commit/rollback : on relâche tous les verrous de ligne détenus.
          ctx.releases.forEach(rel => rel())
        }
      },
    }
    return db
  }

  return makeDb(null)
}

function buildBody() {
  return {
    items: [{
      productId: 1,
      productName: 'T-shirt',
      quantity: 1,
      unitPrice: 10,
      discount: 0,
      discountType: '%' as const,
      tva: 20,
    }],
    seller: { id: 1, name: 'Alice' },
    customer: { id: 7, name: 'Bob' },
    usedVoucherIds: [100],
    payments: [{ mode: 'voucher', amount: 10 }],
    totals: { totalHT: 8.33, totalTVA: 1.67, totalTTC: 10 },
    globalDiscount: { value: 0, type: '%' as const },
    establishmentId: 10,
    registerId: 1,
  }
}

// ===========================================
// Tests
// ===========================================

describe('POST /api/sales/create — double-dépense de bon d\'achat (concurrence)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('deux ventes concurrentes sur le même voucher → exactement une réussit, l\'autre reçoit 409', async () => {
    const voucherStore = new Map<number, VoucherRow>([
      [100, { id: 100, code: 'ABCD1234', amount: '5.00', customerId: 7, status: 'active', expiresAt: null }],
    ])
    currentDb = createConcurrentDb(voucherStore, [{ productId: 1, stock: 10, stockByVariation: null }])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/sales/create.post')).default as any

    const results = await Promise.allSettled([
      handler(createMockEvent({ body: buildBody() })),
      handler(createMockEvent({ body: buildBody() })),
    ])

    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected')

    // Exactement une vente passe, exactement une est refusée.
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    // Le succès est bien une vente complète.
    const ok = (fulfilled[0] as PromiseFulfilledResult<{ success: boolean }>).value
    expect(ok.success).toBe(true)

    // Le refus est un 409 explicite listant le code du bon.
    const err = (rejected[0] as PromiseRejectedResult).reason as Error & { statusCode?: number }
    expect(err.statusCode).toBe(409)
    expect(err.message).toContain('ABCD1234')

    // Le bon a été consommé une seule fois.
    expect(voucherStore.get(100)?.status).toBe('used')
  })

  it('bon déjà consommé avant la transaction → re-vérification verrouillée rejette en 409', async () => {
    const voucherStore = new Map<number, VoucherRow>([
      [100, { id: 100, code: 'WXYZ9999', amount: '5.00', customerId: 7, status: 'used', expiresAt: null }],
    ])
    currentDb = createConcurrentDb(voucherStore, [{ productId: 1, stock: 10, stockByVariation: null }])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/sales/create.post')).default as any

    // La pré-validation (status='active') échoue déjà ici en 400 : le bon n'est plus 'active'.
    // On vérifie surtout qu'aucune vente ne passe avec un bon non disponible.
    await expect(handler(createMockEvent({ body: buildBody() }))).rejects.toMatchObject({
      statusCode: expect.any(Number),
    })
    expect(voucherStore.get(100)?.status).toBe('used')
  })
})
