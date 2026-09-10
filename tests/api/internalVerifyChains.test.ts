import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * A5 — endpoint interne GET /api/internal/verify-chains + sa garde d'auth.
 *
 * Deux niveaux testés séparément, car ils vivent dans deux fichiers :
 * 1. la garde CRON_SECRET, portée par server/middleware/auth.global.ts
 *    (l'endpoint n'est PAS dans PUBLIC_ENDPOINTS — règle absolue n°8) ;
 * 2. le parcours du handler lui-même, avec caisses et chaînes mockées.
 */

const captureMessage = vi.fn()
vi.mock('@sentry/nuxt', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}))

// supabase.ts ne doit jamais être réellement chargé ici (règle n°10 : il porte
// la SERVICE_ROLE_KEY). Le middleware l'importe, on le neutralise.
const assertAuth = vi.fn(async (..._args: unknown[]) => ({}))
vi.mock('~/server/utils/supabase', () => ({
  assertAuth: (...args: unknown[]) => assertAuth(...args),
  getAccessTokenFromEvent: vi.fn(() => null),
  getTenantFromUser: vi.fn(() => null),
  supabaseServerClient: null,
}))

const logChainVerification = vi.fn(async (..._args: unknown[]) => {})
vi.mock('~/server/utils/audit', () => ({
  logChainVerification: (...args: unknown[]) => logChainVerification(...args),
}))

const verifyChainForTenant = vi.fn()
vi.mock('~/server/utils/chainVerification', () => ({
  verifyChainForTenant: (...args: unknown[]) => verifyChainForTenant(...args),
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
}))

vi.mock('~/server/database/schema', () => ({
  sales: { __t: 'sales', tenantId: 'tenantId', registerId: 'registerId', saleDate: 'saleDate' },
}))

let activeRegisters: Array<{ tenantId: string; registerId: number | null }> = []
vi.mock('~/server/database/connection', () => ({
  db: {
    selectDistinct: () => ({
      from: () => ({
        where: () => Promise.resolve(activeRegisters),
      }),
    }),
  },
}))

// ==========================================
// 1. GARDE D'AUTH (middleware)
// ==========================================

describe('A5 — garde CRON_SECRET sur /api/internal/*', () => {
  let handler: (event: unknown) => Promise<unknown>
  let headers: Record<string, string>

  interface ThrownError { statusCode?: number }

  beforeEach(async () => {
    vi.resetModules()
    headers = {}
    assertAuth.mockClear()

    vi.stubGlobal('createError', (data: Record<string, unknown>) => {
      const err = new Error(String(data.statusMessage || data.message)) as Error & ThrownError
      err.statusCode = data.statusCode as number
      return err
    })
    vi.stubGlobal('getHeader', (_event: unknown, name: string) => headers[name.toLowerCase()])
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { nodeEnv: 'test' } }))

    handler = (await import('~/server/middleware/auth.global')).default as never
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CRON_SECRET
  })

  const event = { path: '/api/internal/verify-chains', method: 'GET', context: {} }

  it('401 si aucun secret n’est présenté', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('401 si le secret présenté est faux', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers.authorization = 'Bearer mauvais-secret'
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('401 si le secret présenté est un préfixe du bon (longueurs différentes)', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers.authorization = 'Bearer le-vrai'
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('401 fail-closed si CRON_SECRET n’est pas configuré, même avec un header', async () => {
    delete process.env.CRON_SECRET
    headers.authorization = 'Bearer nimporte-quoi'
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('laisse passer un Authorization: Bearer correct (format Vercel Cron)', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers.authorization = 'Bearer le-vrai-secret'
    await expect(handler(event)).resolves.toBeUndefined()
  })

  it('laisse passer un x-cron-secret correct (appel manuel de runbook)', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers['x-cron-secret'] = 'le-vrai-secret'
    await expect(handler(event)).resolves.toBeUndefined()
  })

  it('ne pose JAMAIS event.context.auth et n’appelle jamais assertAuth', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers['x-cron-secret'] = 'le-vrai-secret'
    const ev = { path: '/api/internal/verify-chains', method: 'GET', context: {} as Record<string, unknown> }

    await handler(ev)

    expect(ev.context.auth).toBeUndefined()
    expect(assertAuth).not.toHaveBeenCalled()
  })

  it('n’ouvre pas les autres routes /api : elles passent toujours par assertAuth', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers['x-cron-secret'] = 'le-vrai-secret'

    await handler({ path: '/api/sales/create', method: 'POST', context: {} })

    expect(assertAuth).toHaveBeenCalledTimes(1)
  })
})

// ==========================================
// 2. PARCOURS DU HANDLER
// ==========================================

describe('A5 — GET /api/internal/verify-chains', () => {
  let handler: (event: unknown) => Promise<{
    success: boolean
    businessDay: string
    registersChecked: number
    ticketsChecked: number
    registersFailed: number
  }>

  const valid = (ticketCount: number) => ({ isValid: true, ticketCount, brokenLinks: [] })
  const broken = (ticketCount: number, tickets: string[]) => ({
    isValid: false,
    ticketCount,
    brokenLinks: tickets.map(t => ({ ticketNumber: t, reason: 'Hash du ticket incorrect' })),
  })

  beforeEach(async () => {
    vi.resetModules()
    captureMessage.mockReset()
    logChainVerification.mockClear()
    verifyChainForTenant.mockReset()
    activeRegisters = []

    vi.useFakeTimers()
    // 2026-09-10 06:00 Europe/Paris (CEST = UTC+2) → jour métier précédent : 2026-09-09.
    vi.setSystemTime(new Date('2026-09-10T04:00:00Z'))
    vi.stubGlobal('setResponseStatus', vi.fn())

    const mod = await import('~/server/api/internal/verify-chains.get')
    handler = mod.default as never
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('cible le jour métier précédent, ancré Europe/Paris', async () => {
    const result = await handler({})
    expect(result.businessDay).toBe('2026-09-09')
  })

  it('ne fait rien quand aucune caisse n’a encaissé la veille', async () => {
    const result = await handler({})

    expect(result).toMatchObject({ success: true, registersChecked: 0, ticketsChecked: 0, registersFailed: 0 })
    expect(verifyChainForTenant).not.toHaveBeenCalled()
    expect(logChainVerification).not.toHaveBeenCalled()
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('vérifie CAISSE PAR CAISSE (le chaînage NF525 est par registre)', async () => {
    activeRegisters = [
      { tenantId: 'tenant-1', registerId: 1 },
      { tenantId: 'tenant-1', registerId: 2 },
      { tenantId: 'tenant-2', registerId: 9 },
    ]
    verifyChainForTenant.mockResolvedValue(valid(10))

    const result = await handler({})

    expect(verifyChainForTenant).toHaveBeenCalledTimes(3)
    // Chaque appel porte SON registerId : jamais un balayage tous registres
    // confondus, qui produirait de faux « hash précédent incorrect ».
    for (const call of verifyChainForTenant.mock.calls) {
      expect(call[1].registerId).toBeTypeOf('number')
      expect(call[1].from).toBeInstanceOf(Date)
      expect(call[1].to).toBeInstanceOf(Date)
    }
    expect(result).toMatchObject({ registersChecked: 3, ticketsChecked: 30, registersFailed: 0 })
  })

  it('journalise la vérification dans l’audit trail pour chaque caisse vérifiée', async () => {
    activeRegisters = [{ tenantId: 'tenant-1', registerId: 4 }]
    verifyChainForTenant.mockResolvedValue(valid(7))

    await handler({})

    expect(logChainVerification).toHaveBeenCalledTimes(1)
    expect(logChainVerification).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      registerId: 4,
      isValid: true,
      ticketCount: 7,
      userName: 'System (cron)',
    }))
  })

  it('n’écrit pas d’audit et n’alerte pas pour une caisse sans ticket', async () => {
    activeRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
    verifyChainForTenant.mockResolvedValue(valid(0))

    await handler({})

    expect(logChainVerification).not.toHaveBeenCalled()
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('alerte Sentry en error sur une chaîne cassée, avec les tickets fautifs', async () => {
    activeRegisters = [{ tenantId: 'tenant-1', registerId: 3 }]
    verifyChainForTenant.mockResolvedValue(broken(5, ['20260909-E01-R03-000002']))

    const result = await handler({})

    expect(result.registersFailed).toBe(1)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [message, ctx] = captureMessage.mock.calls[0] as [string, { level: string; tags: Record<string, string>; extra: Record<string, unknown> }]
    expect(message).toContain('chaîne de tickets cassée')
    expect(ctx.level).toBe('error')
    expect(ctx.tags.source).toBe('cron')
    expect(ctx.tags.tenantId).toBe('tenant-1')
    expect(ctx.extra.businessDay).toBe('2026-09-09')
    expect(ctx.extra.brokenTicketNumbers).toEqual(['20260909-E01-R03-000002'])
  })

  it('n’alerte pas quand toutes les chaînes sont intactes', async () => {
    activeRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
    verifyChainForTenant.mockResolvedValue(valid(3))

    await handler({})

    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('poursuit le balayage quand une caisse plante (pas d’angle mort sur les suivantes)', async () => {
    activeRegisters = [
      { tenantId: 'tenant-1', registerId: 1 },
      { tenantId: 'tenant-1', registerId: 2 },
      { tenantId: 'tenant-1', registerId: 3 },
    ]
    verifyChainForTenant
      .mockResolvedValueOnce(valid(4))
      .mockRejectedValueOnce(new Error('connection terminated'))
      .mockResolvedValueOnce(broken(2, ['T-9']))

    const result = await handler({})

    expect(verifyChainForTenant).toHaveBeenCalledTimes(3)
    // La caisse en erreur n'est comptée ni comme vérifiée ni comme cassée ;
    // la caisse suivante est bien alertée.
    expect(result.registersChecked).toBe(2)
    expect(result.registersFailed).toBe(1)
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })

  it('saute les ventes sans caisse et le signale dans le résumé', async () => {
    // sales.registerId est nullable (ventes historiques) : ces lignes
    // n'appartiennent à aucune chaîne par registre. Elles doivent être comptées,
    // pas ignorées en silence.
    activeRegisters = [
      { tenantId: 'tenant-1', registerId: null },
      { tenantId: 'tenant-1', registerId: 2 },
    ]
    verifyChainForTenant.mockResolvedValue(valid(5))

    const result = await handler({}) as unknown as { tenantsSkippedWithoutRegister: number; registersChecked: number }

    expect(verifyChainForTenant).toHaveBeenCalledTimes(1)
    expect(result.registersChecked).toBe(1)
    expect(result.tenantsSkippedWithoutRegister).toBe(1)
  })

  it('n’échoue pas si la capture Sentry lève (l’observabilité ne bloque pas le cron)', async () => {
    activeRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
    verifyChainForTenant.mockResolvedValue(broken(2, ['T-1']))
    captureMessage.mockImplementation(() => {
      throw new Error('Sentry transport down')
    })

    const result = await handler({})

    expect(result).toMatchObject({ success: true, registersFailed: 1 })
  })
})
