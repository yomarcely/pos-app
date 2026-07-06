import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

/**
 * ==========================================================================
 * POST /api/sales/close-day — clôture NF525 (zone critique)
 * ==========================================================================
 *
 * Caractérise + verrouille le comportement bloquant :
 *  - clôture saine → succès, audit non forcé
 *  - incohérence HT+TVA≠TTC (> 1 centime) → 409 ; force=true → passe + audit
 *    enrichi (anomalies.totalsDiscrepancy)
 *  - tickets en attente → 409 (liste sommaire) ; force=true → passe + audit
 *    enrichi (anomalies.pendingSales)
 *
 * Faux runner `db` : SELECT routés par IDENTITÉ de table (Map), INSERT capturés
 * par table avec returning. financialValidation n'est PAS mocké (vrai calcul).
 */

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.data = data.data
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id'),
}))

const loggerWarn = vi.fn()
vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: (...args: unknown[]) => loggerWarn(...args), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (_event: unknown) => {
    const event = _event as { body?: unknown }
    return event?.body || {}
  }),
}))

vi.mock('~/server/validators/sale.schema', () => ({
  closeDaySchema: {},
}))

// Capture des appels d'audit pour vérifier l'enrichissement forced/anomalies
const logClosure = vi.fn(async (..._args: unknown[]) => {})
const logSystemError = vi.fn(async (..._args: unknown[]) => {})
vi.mock('~/server/utils/audit', () => ({
  logClosure: (...args: unknown[]) => logClosure(...args),
  logSystemError: (...args: unknown[]) => logSystemError(...args),
}))

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}))

const tables = {
  sales: { __t: 'sales' },
  closures: { __t: 'closures' },
  registers: { __t: 'registers' },
  pendingSales: { __t: 'pendingSales' },
}

vi.mock('~/server/database/schema', () => tables)

let readResults: Map<unknown, unknown[]>
let insertedByTable: Map<unknown, Array<Record<string, unknown>>>

// Agrégat SQL des totaux (étape 3a) : reproduit fidèlement le périmètre et la
// somme en centimes du handler à partir des lignes de `sales`, sauf si le test
// fournit un résultat explicite via readResults.get('salesAggregate') (pour
// forcer un écart JS↔SQL et exercer le logger.warn de transition).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeAggregate(rows: Array<Record<string, any>> = []) {
  const inScope = rows.filter(s =>
    (s.status === 'completed' && s.type !== 'credit_note') ||
    s.type === 'credit_note' ||
    (s.status === 'cancelled' && s.creditNoteId != null)
  )
  const sum = (k: string) => inScope.reduce((acc, s) => acc + Math.round(Number(s[k]) * 100), 0)
  return {
    totalTTCCents: String(sum('totalTTC')),
    totalHTCents: String(sum('totalHT')),
    totalTVACents: String(sum('totalTVA')),
  }
}

function makeRunner() {
  function selectChain(fields?: Record<string, unknown>) {
    let fromTable: unknown = null
    const isAggregate = !!fields && 'totalTTCCents' in fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      from: vi.fn((t: unknown) => { fromTable = t; return chain }),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const result = isAggregate
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (readResults.get('salesAggregate') as unknown[]) ?? [computeAggregate(readResults.get(tables.sales) as any[])]
          : (readResults.get(fromTable) || [])
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return chain
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runner: any = {
    select: vi.fn((fields?: Record<string, unknown>) => selectChain(fields)),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        const arr = insertedByTable.get(table) || []
        arr.push(vals)
        insertedByTable.set(table, arr)
        return {
          returning: vi.fn(() => Promise.resolve([{ id: 1, createdAt: new Date('2026-06-14T18:00:00Z'), ...vals }])),
        }
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    })),
  }
  return runner
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any
vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb },
}))

async function importHandler() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await import('~/server/api/sales/close-day.post')).default as any
}

function sale(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenantId: 'test-tenant-id',
    ticketNumber: '20260614-E01-R01-000001',
    status: 'completed',
    type: 'sale',
    creditNoteId: null,
    registerId: 1,
    saleDate: new Date('2026-06-14T10:00:00Z'),
    totalHT: '83.33',
    totalTVA: '16.67',
    totalTTC: '100.00',
    currentHash: 'HASH1',
    payments: [{ mode: 'cash', amount: 100 }],
    ...overrides,
  }
}

function setReads(opts: {
  sales?: Array<Record<string, unknown>>
  pending?: Array<Record<string, unknown>>
  closure?: Array<Record<string, unknown>>
} = {}) {
  readResults.set(tables.registers, [{ id: 1, registerNumber: 1, establishmentId: 1, tenantId: 'test-tenant-id' }])
  readResults.set(tables.closures, opts.closure ?? [])
  readResults.set(tables.pendingSales, opts.pending ?? [])
  readResults.set(tables.sales, opts.sales ?? [sale()])
}

describe('POST /api/sales/close-day — clôture bloquante NF525', () => {
  beforeEach(() => {
    vi.resetModules()
    readResults = new Map()
    insertedByTable = new Map()
    logClosure.mockClear()
    logSystemError.mockClear()
    loggerWarn.mockClear()
    currentDb = makeRunner()
  })

  it('clôture saine : succès, non forcée, totaux cohérents', async () => {
    setReads()
    const handler = await importHandler()
    const res = await handler(createMockEvent({ body: { date: '2026-06-14', registerId: 1 } }))

    expect(res.success).toBe(true)
    expect(res.forced).toBe(false)
    expect(res.closure.totalTTC).toBe(100)

    const closureInsert = (insertedByTable.get(tables.closures) || [])[0]
    expect(closureInsert).toBeDefined()

    expect(logClosure).toHaveBeenCalledOnce()
    expect(logClosure).toHaveBeenCalledWith(
      expect.objectContaining({ forced: false, anomalies: null })
    )
  })

  it('incohérence HT+TVA≠TTC (> 1 centime) → 409 détaillé, pas de clôture', async () => {
    // 80 + 16 = 96 ≠ 100 → écart -4.00 €
    setReads({ sales: [sale({ totalHT: '80.00', totalTVA: '16.00', totalTTC: '100.00' })] })
    const handler = await importHandler()

    await expect(
      handler(createMockEvent({ body: { date: '2026-06-14', registerId: 1 } }))
    ).rejects.toMatchObject({
      statusCode: 409,
      data: expect.objectContaining({ reason: 'totals_mismatch', diffCents: -400, code: 'TOTALS_MISMATCH', retryable: false }),
    })

    // Aucune clôture créée
    expect(insertedByTable.get(tables.closures)).toBeUndefined()
    expect(logClosure).not.toHaveBeenCalled()
  })

  it('incohérence des totaux + force=true → clôture + anomalie auditée', async () => {
    setReads({ sales: [sale({ totalHT: '80.00', totalTVA: '16.00', totalTTC: '100.00' })] })
    const handler = await importHandler()

    const res = await handler(createMockEvent({ body: { date: '2026-06-14', registerId: 1, force: true } }))

    expect(res.success).toBe(true)
    expect(res.forced).toBe(true)
    expect(logClosure).toHaveBeenCalledWith(
      expect.objectContaining({
        forced: true,
        anomalies: expect.objectContaining({
          totalsDiscrepancy: expect.objectContaining({ diffCents: -400 }),
        }),
      })
    )
  })

  it('tickets en attente → 409 avec liste sommaire, pas de clôture', async () => {
    setReads({
      pending: [
        { id: 7, items: [{}, {}], createdAt: new Date('2026-06-14T09:00:00Z'), createdByEmail: 'vendeur@x.fr' },
        { id: 8, items: [{}], createdAt: new Date('2026-06-14T09:30:00Z'), createdByEmail: null },
      ],
    })
    const handler = await importHandler()

    await expect(
      handler(createMockEvent({ body: { date: '2026-06-14', registerId: 1 } }))
    ).rejects.toMatchObject({
      statusCode: 409,
      data: expect.objectContaining({
        reason: 'pending_sales',
        code: 'PENDING_SALES',
        retryable: false,
        pendingCount: 2,
        pendingSales: expect.arrayContaining([
          expect.objectContaining({ id: 7, itemCount: 2, createdByEmail: 'vendeur@x.fr' }),
          expect.objectContaining({ id: 8, itemCount: 1, createdByEmail: null }),
        ]),
      }),
    })

    expect(insertedByTable.get(tables.closures)).toBeUndefined()
    expect(logClosure).not.toHaveBeenCalled()
  })

  it('tickets en attente + force=true → clôture + paniers abandonnés audités', async () => {
    setReads({
      pending: [
        { id: 7, items: [{}, {}], createdAt: new Date('2026-06-14T09:00:00Z'), createdByEmail: 'vendeur@x.fr' },
      ],
    })
    const handler = await importHandler()

    const res = await handler(createMockEvent({ body: { date: '2026-06-14', registerId: 1, force: true } }))

    expect(res.success).toBe(true)
    expect(res.forced).toBe(true)
    expect(logClosure).toHaveBeenCalledWith(
      expect.objectContaining({
        forced: true,
        anomalies: expect.objectContaining({
          pendingSales: expect.arrayContaining([
            expect.objectContaining({ id: 7, itemCount: 2 }),
          ]),
        }),
      })
    )
  })

  it('agrégat SQL des totaux concorde avec le JS → aucun avertissement de transition', async () => {
    // Périmètre mixte : vente normale + avoir (négatif) + vente annulée compensée.
    setReads({
      sales: [
        sale({ id: 1, totalHT: '83.33', totalTVA: '16.67', totalTTC: '100.00' }),
        sale({ id: 2, type: 'credit_note', totalHT: '-41.67', totalTVA: '-8.33', totalTTC: '-50.00', ticketNumber: '20260614-E01-R01-000003' }),
        sale({ id: 3, status: 'cancelled', creditNoteId: 2, totalHT: '41.67', totalTVA: '8.33', totalTTC: '50.00', ticketNumber: '20260614-E01-R01-000002' }),
      ],
    })
    const handler = await importHandler()
    const res = await handler(createMockEvent({ body: { date: '2026-06-14', registerId: 1 } }))

    expect(res.success).toBe(true)
    // completed(100) + avoir(-50) + annulée compensée(+50) = 100
    expect(res.closure.totalTTC).toBe(100)
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it('écart JS vs agrégat SQL → logger.warn (transition), clôture non bloquée', async () => {
    setReads()
    // Force un agrégat SQL divergent du calcul JS (100,00 € en JS).
    readResults.set('salesAggregate', [{ totalTTCCents: '9999', totalHTCents: '8333', totalTVACents: '1666' }])
    const handler = await importHandler()

    const res = await handler(createMockEvent({ body: { date: '2026-06-14', registerId: 1 } }))

    // L'écart est non bloquant : la clôture aboutit sur la base du JS (source de vérité).
    expect(res.success).toBe(true)
    expect(res.closure.totalTTC).toBe(100)
    expect(loggerWarn).toHaveBeenCalledTimes(1)
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        js: expect.objectContaining({ totalTTCCents: 10000 }),
        sql: expect.objectContaining({ totalTTCCents: 9999 }),
      }),
      expect.stringContaining('Écart totaux clôture JS vs agrégat SQL'),
    )
  })

  it('journée déjà clôturée → 400', async () => {
    setReads({ closure: [{ id: 99 }] })
    const handler = await importHandler()
    await expect(
      handler(createMockEvent({ body: { date: '2026-06-14', registerId: 1 } }))
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('caisse introuvable → 404', async () => {
    setReads()
    readResults.set(tables.registers, [])
    const handler = await importHandler()
    await expect(
      handler(createMockEvent({ body: { date: '2026-06-14', registerId: 999 } }))
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
