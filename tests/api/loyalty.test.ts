import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'

;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id'),
}))

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (_event: unknown) => {
    const event = _event as { body?: unknown }
    return event?.body || {}
  }),
}))

vi.mock('~/server/validators/loyalty.schema', () => ({
  updateLoyaltyConfigSchema: {},
}))

const auditMocks = {
  logEntityCreation: vi.fn(),
  logEntityUpdate: vi.fn(),
}
vi.mock('~/server/utils/audit', () => auditMocks)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb },
}))

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
  gt: (...args: unknown[]) => ({ type: 'gt', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  sql: (...args: unknown[]) => args,
}))

vi.mock('h3', () => ({
  getRequestIP: vi.fn(() => '127.0.0.1'),
}))

vi.mock('~/server/utils/loyalty', () => ({
  getActiveLoyaltyConfig: vi.fn(),
  getCustomerLoyaltyPoints: vi.fn(),
}))

vi.mock('~/server/database/schema', () => ({
  loyaltyConfig: {
    id: 'lc.id',
    tenantId: 'lc.tenantId',
    enabled: 'lc.enabled',
    pointMode: 'lc.pointMode',
    thresholdPoints: 'lc.thresholdPoints',
    rewardType: 'lc.rewardType',
    rewardValue: 'lc.rewardValue',
    voucherValidityDays: 'lc.voucherValidityDays',
  },
  customers: {
    id: 'customers.id',
    tenantId: 'customers.tenantId',
    loyaltyProgram: 'customers.loyaltyProgram',
  },
  loyaltyVouchers: {
    id: 'lv.id',
    tenantId: 'lv.tenantId',
    customerId: 'lv.customerId',
    code: 'lv.code',
    amount: 'lv.amount',
    status: 'lv.status',
    expiresAt: 'lv.expiresAt',
    createdAt: 'lv.createdAt',
  },
}))

function createReadChain(rows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  }
  return chain
}

function createUpsertChain(existingRow: unknown | null, returnedRow: unknown) {
  let selectIdx = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectChain: any = {
    select: vi.fn(() => selectChain),
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(() => {
      selectIdx++
      return Promise.resolve(existingRow ? [existingRow] : [])
    }),
  }
  return {
    select: selectChain.select,
    from: selectChain.from,
    where: selectChain.where,
    limit: selectChain.limit,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([returnedRow])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([returnedRow])),
      })),
    })),
  }
}

describe('GET /api/loyalty/config', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('retourne les défauts si aucune config persistée', async () => {
    currentDb = createReadChain([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/loyalty/config.get')).default as any
    const res = await handler(createMockEvent())

    expect(res.success).toBe(true)
    expect(res.config).toEqual({
      enabled: false,
      pointMode: 'per_euro',
      thresholdPoints: 100,
      rewardType: 'percent_discount',
      rewardValue: 5,
      voucherValidityDays: 60,
    })
  })

  it('retourne la config persistée et parse rewardValue en number', async () => {
    currentDb = createReadChain([{
      id: 1, tenantId: 'test-tenant-id',
      enabled: true,
      pointMode: 'per_ticket',
      thresholdPoints: 10,
      rewardType: 'voucher',
      rewardValue: '15.00',
      voucherValidityDays: 30,
    }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/loyalty/config.get')).default as any
    const res = await handler(createMockEvent())

    expect(res.success).toBe(true)
    expect(res.config).toEqual({
      enabled: true,
      pointMode: 'per_ticket',
      thresholdPoints: 10,
      rewardType: 'voucher',
      rewardValue: 15,
      voucherValidityDays: 30,
    })
  })
})

describe('PUT /api/loyalty/config', () => {
  beforeEach(() => {
    vi.resetModules()
    auditMocks.logEntityCreation.mockClear()
    auditMocks.logEntityUpdate.mockClear()
  })

  const validBody = {
    enabled: true,
    pointMode: 'per_euro',
    thresholdPoints: 50,
    rewardType: 'percent_discount',
    rewardValue: 10,
    voucherValidityDays: 90,
  }

  it('crée la config si aucune n\'existe et appelle logEntityCreation', async () => {
    const created = {
      id: 1, tenantId: 'test-tenant-id',
      enabled: true, pointMode: 'per_euro', thresholdPoints: 50,
      rewardType: 'percent_discount', rewardValue: '10',
      voucherValidityDays: 90,
    }
    currentDb = createUpsertChain(null, created)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/loyalty/config.put')).default as any
    const res = await handler(createMockEvent({ body: validBody }))

    expect(res.success).toBe(true)
    expect(res.config.enabled).toBe(true)
    expect(res.config.rewardValue).toBe(10)
    expect(currentDb.insert).toHaveBeenCalled()
    expect(auditMocks.logEntityCreation).toHaveBeenCalledTimes(1)
    expect(auditMocks.logEntityUpdate).not.toHaveBeenCalled()
  })

  it('met à jour la config si elle existe et appelle logEntityUpdate', async () => {
    const existing = {
      id: 5, tenantId: 'test-tenant-id',
      enabled: false, pointMode: 'per_euro', thresholdPoints: 100,
      rewardType: 'percent_discount', rewardValue: '5',
      voucherValidityDays: 60,
    }
    const updated = { ...existing, enabled: true, thresholdPoints: 50, rewardValue: '10' }
    currentDb = createUpsertChain(existing, updated)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/loyalty/config.put')).default as any
    const res = await handler(createMockEvent({ body: validBody }))

    expect(res.success).toBe(true)
    expect(res.config.enabled).toBe(true)
    expect(res.config.thresholdPoints).toBe(50)
    expect(currentDb.update).toHaveBeenCalled()
    expect(auditMocks.logEntityUpdate).toHaveBeenCalledTimes(1)
    expect(auditMocks.logEntityCreation).not.toHaveBeenCalled()
  })
})

describe('GET /api/clients/:id/loyalty-status', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // Helper : mock db pour 2 selects séquentiels (customer puis vouchers)
  function createLoyaltyStatusChain(customerRow: unknown | null, voucherRows: unknown[] = []) {
    let selectIdx = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: vi.fn(() => { selectIdx++; return chain }),
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve(customerRow ? [customerRow] : [])),
      orderBy: vi.fn(() => Promise.resolve(voucherRows)),
    }
    return chain
  }

  it('retourne enabled=false si pas de config active', async () => {
    const loyaltyMod = await import('~/server/utils/loyalty')
    vi.mocked(loyaltyMod.getActiveLoyaltyConfig).mockResolvedValue(null)
    currentDb = createLoyaltyStatusChain({ id: 1, loyaltyProgram: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/[id]/loyalty-status.get')).default as any
    const event = createMockEvent({ params: { id: '1' }, query: { establishmentId: '5' } })
    const res = await handler(event)

    expect(res).toEqual({ success: true, enabled: false })
  })

  it('retourne optedIn=false si client sans loyaltyProgram', async () => {
    const loyaltyMod = await import('~/server/utils/loyalty')
    vi.mocked(loyaltyMod.getActiveLoyaltyConfig).mockResolvedValue({
      enabled: true, pointMode: 'per_euro', thresholdPoints: 100,
      rewardType: 'percent_discount', rewardValue: 5, voucherValidityDays: 60,
    })
    currentDb = createLoyaltyStatusChain({ id: 1, loyaltyProgram: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/[id]/loyalty-status.get')).default as any
    const res = await handler(createMockEvent({ params: { id: '1' }, query: { establishmentId: '5' } }))

    expect(res).toMatchObject({ success: true, enabled: false, optedIn: false })
  })

  it('retourne immediateRewardEligible=true quand seuil atteint et reward != voucher', async () => {
    const loyaltyMod = await import('~/server/utils/loyalty')
    vi.mocked(loyaltyMod.getActiveLoyaltyConfig).mockResolvedValue({
      enabled: true, pointMode: 'per_euro', thresholdPoints: 100,
      rewardType: 'percent_discount', rewardValue: 5, voucherValidityDays: 60,
    })
    vi.mocked(loyaltyMod.getCustomerLoyaltyPoints).mockResolvedValue(120)
    currentDb = createLoyaltyStatusChain({ id: 1, loyaltyProgram: true }, [])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/[id]/loyalty-status.get')).default as any
    const res = await handler(createMockEvent({ params: { id: '1' }, query: { establishmentId: '5' } }))

    expect(res).toMatchObject({
      enabled: true,
      optedIn: true,
      pointsCurrent: 120,
      pointsRequired: 100,
      pointsRemaining: 0,
      rewardType: 'percent_discount',
      rewardValue: 5,
      immediateRewardEligible: true,
      vouchers: [],
    })
  })

  it('immediateRewardEligible=false pour reward type voucher (génération séparée)', async () => {
    const loyaltyMod = await import('~/server/utils/loyalty')
    vi.mocked(loyaltyMod.getActiveLoyaltyConfig).mockResolvedValue({
      enabled: true, pointMode: 'per_euro', thresholdPoints: 100,
      rewardType: 'voucher', rewardValue: 10, voucherValidityDays: 60,
    })
    vi.mocked(loyaltyMod.getCustomerLoyaltyPoints).mockResolvedValue(150)
    currentDb = createLoyaltyStatusChain({ id: 1, loyaltyProgram: true }, [])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/[id]/loyalty-status.get')).default as any
    const res = await handler(createMockEvent({ params: { id: '1' }, query: { establishmentId: '5' } }))

    expect(res.immediateRewardEligible).toBe(false)
    expect(res.rewardType).toBe('voucher')
  })

  it('liste les vouchers actifs du client avec montant parsé', async () => {
    const loyaltyMod = await import('~/server/utils/loyalty')
    vi.mocked(loyaltyMod.getActiveLoyaltyConfig).mockResolvedValue({
      enabled: true, pointMode: 'per_euro', thresholdPoints: 100,
      rewardType: 'voucher', rewardValue: 10, voucherValidityDays: 60,
    })
    vi.mocked(loyaltyMod.getCustomerLoyaltyPoints).mockResolvedValue(50)
    const expiresAt = new Date('2026-08-01T00:00:00Z')
    currentDb = createLoyaltyStatusChain({ id: 1, loyaltyProgram: true }, [
      { id: 10, code: 'A1B2C3D4', amount: '10.00', expiresAt, createdAt: new Date('2026-04-01') },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/[id]/loyalty-status.get')).default as any
    const res = await handler(createMockEvent({ params: { id: '1' }, query: { establishmentId: '5' } }))

    expect(res.vouchers).toHaveLength(1)
    expect(res.vouchers[0]).toMatchObject({
      id: 10, code: 'A1B2C3D4', amount: 10, expiresAt,
    })
  })

  it('throw 400 si establishmentId manquant', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (await import('~/server/api/clients/[id]/loyalty-status.get')).default as any

    await expect(
      handler(createMockEvent({ params: { id: '1' } })),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'customerId et establishmentId requis',
    })
  })
})
