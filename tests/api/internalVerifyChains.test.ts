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
/** Si renseignée, la requête des caisses actives échoue avec cette erreur. */
let activeRegistersError: Error | null = null
vi.mock('~/server/database/connection', () => ({
  db: {
    selectDistinct: () => ({
      from: () => ({
        where: () => (activeRegistersError ? Promise.reject(activeRegistersError) : Promise.resolve(activeRegisters)),
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
    vi.unstubAllEnvs()
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

  // --- Cas de refus ajoutés après la relecture d'A5 (2026-11-11) ---

  it.each([
    ['vide', ''],
    ['fait d’espaces', '   '],
  ])('401 fail-closed si CRON_SECRET est %s (état de .env.example)', async (_label, value) => {
    process.env.CRON_SECRET = value

    headers.authorization = 'Bearer nimporte-quoi'
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })

    // Présenter exactement la valeur « vide » configurée ne doit pas passer non plus.
    headers.authorization = `Bearer ${value}`
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })

    delete headers.authorization
    headers['x-cron-secret'] = value
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('401 si « Authorization: Bearer » ne porte rien', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers.authorization = 'Bearer '
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('401 si x-cron-secret est vide', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers['x-cron-secret'] = ''
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it.each([
    'bearer le-vrai-secret',
    'Basic le-vrai-secret',
    'Bearerle-vrai-secret',
    'le-vrai-secret',
  ])('401 si le préfixe Authorization est mal formé : « %s »', async (value) => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers.authorization = value
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('401 si le secret présenté est plus long que le bon', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers.authorization = 'Bearer le-vrai-secret-et-plus'
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('un chemin qui commence seulement par « /api/internal » sans en faire partie passe par assertAuth', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers['x-cron-secret'] = 'le-vrai-secret'

    await handler({ path: '/api/internalfoo', method: 'GET', context: {} })

    expect(assertAuth).toHaveBeenCalledTimes(1)
  })

  // Une route index (server/api/internal/index.get.ts) serait servie sur
  // « /api/internal », sans barre finale. Elle doit être gardée par le secret,
  // pas ouverte à tout utilisateur connecté via assertAuth.
  it.each([
    '/api/internal',
    '/api/internal?x=1',
    '/api/internal/',
    '/api/internal/?x=1',
    '/api/internal/verify-chains?date=2026-09-09',
  ])('exige le secret sur « %s » et n’appelle jamais assertAuth', async (path) => {
    process.env.CRON_SECRET = 'le-vrai-secret'

    await expect(handler({ path, method: 'GET', context: {} })).rejects.toMatchObject({ statusCode: 401 })
    expect(assertAuth).not.toHaveBeenCalled()

    headers.authorization = 'Bearer le-vrai-secret'
    const ev = { path, method: 'GET', context: {} as Record<string, unknown> }
    await expect(handler(ev)).resolves.toBeUndefined()
    expect(ev.context.auth).toBeUndefined()
    expect(assertAuth).not.toHaveBeenCalled()
  })

  it('une query string ne suffit pas à faire passer une route pour interne', async () => {
    process.env.CRON_SECRET = 'le-vrai-secret'
    headers['x-cron-secret'] = 'le-vrai-secret'

    await handler({ path: '/api/sales?next=/api/internal/', method: 'GET', context: {} })

    expect(assertAuth).toHaveBeenCalledTimes(1)
  })

  it('ALLOW_AUTH_BYPASS=true en dev n’ouvre pas la route interne : le secret reste exigé', async () => {
    vi.stubEnv('ALLOW_AUTH_BYPASS', 'true')
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { nodeEnv: 'development' } }))
    vi.resetModules()
    const devHandler = (await import('~/server/middleware/auth.global')).default as unknown as typeof handler

    process.env.CRON_SECRET = 'le-vrai-secret'
    await expect(devHandler(event)).rejects.toMatchObject({ statusCode: 401 })

    headers.authorization = 'Bearer mauvais-secret'
    await expect(devHandler(event)).rejects.toMatchObject({ statusCode: 401 })
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
    registersErrored: number
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
    activeRegistersError = null

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
    // La caisse en erreur n'est comptée ni comme vérifiée ni comme cassée :
    // elle a son propre compteur et sa propre alerte. La caisse suivante est
    // bien vérifiée et alertée.
    expect(result.registersChecked).toBe(2)
    expect(result.registersFailed).toBe(1)
    expect(result.registersErrored).toBe(1)
    expect(captureMessage).toHaveBeenCalledTimes(2)
    const messages = captureMessage.mock.calls.map(c => c[0] as string)
    expect(messages).toEqual([
      'NF525 : vérification de chaîne impossible',
      'NF525 : chaîne de tickets cassée',
    ])
  })

  it('une caisse dont la vérification plante n’est JAMAIS déclarée intacte', async () => {
    // Relecture A5 (2026-11-11) : un ticket rendu illisible par une altération
    // en base fait lever la vérification. Avant ce correctif, le cron répondait
    // « registersFailed: 0 » et loguait « toutes les chaînes intactes ».
    activeRegisters = [{ tenantId: 'tenant-1', registerId: 7 }]
    verifyChainForTenant.mockRejectedValue(new TypeError('p.amount.toFixed is not a function'))
    const { logger } = await import('~/server/utils/logger')
    vi.mocked(logger.info).mockClear()
    vi.mocked(logger.error).mockClear()

    const result = await handler({})

    expect(result).toMatchObject({ success: true, registersChecked: 0, registersFailed: 0, registersErrored: 1 })

    // Alerte dédiée, de niveau error, sans le message d'erreur (il peut contenir des données).
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [message, ctx] = captureMessage.mock.calls[0] as [string, { level: string; tags: Record<string, string>; extra: Record<string, unknown> }]
    expect(message).toBe('NF525 : vérification de chaîne impossible')
    expect(ctx.level).toBe('error')
    expect(ctx.tags.tenantId).toBe('tenant-1')
    expect(ctx.extra).toEqual({ registerId: 7, businessDay: '2026-09-09', errorName: 'TypeError' })
    expect(JSON.stringify(ctx)).not.toContain('toFixed')

    // Le résumé ne dit pas « intactes » ; il est logué en anomalie.
    const infoMessages = vi.mocked(logger.info).mock.calls.map(c => String(c[1] ?? c[0]))
    expect(infoMessages.some(m => m.includes('intactes'))).toBe(false)
    const errorMessages = vi.mocked(logger.error).mock.calls.map(c => String(c[1] ?? c[0]))
    expect(errorMessages.some(m => m.includes('AVEC ANOMALIES'))).toBe(true)

    // Pas de ligne d'audit « chaîne valide/invalide » : on ne sait pas.
    expect(logChainVerification).not.toHaveBeenCalled()
  })

  it('logue « toutes les chaînes intactes » uniquement quand rien n’est cassé ni en erreur', async () => {
    activeRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
    verifyChainForTenant.mockResolvedValue(valid(3))
    const { logger } = await import('~/server/utils/logger')
    vi.mocked(logger.info).mockClear()

    const result = await handler({})

    expect(result.registersErrored).toBe(0)
    const infoMessages = vi.mocked(logger.info).mock.calls.map(c => String(c[1] ?? c[0]))
    expect(infoMessages.some(m => m.includes('toutes les chaînes intactes'))).toBe(true)
  })

  it('une panne Sentry pendant l’alerte « vérification impossible » ne bloque pas le balayage', async () => {
    activeRegisters = [
      { tenantId: 'tenant-1', registerId: 1 },
      { tenantId: 'tenant-1', registerId: 2 },
    ]
    verifyChainForTenant
      .mockRejectedValueOnce(new Error('connection terminated'))
      .mockResolvedValueOnce(valid(4))
    captureMessage.mockImplementation(() => {
      throw new Error('Sentry transport down')
    })

    const result = await handler({})

    // L'alerte a bien été tentée (et a levé) : le balayage a continué malgré tout.
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ success: true, registersChecked: 1, registersErrored: 1 })
  })

  it('compte aussi une caisse quand ce qui est levé n’est pas une Error', async () => {
    activeRegisters = [{ tenantId: 'tenant-1', registerId: 5 }]
    verifyChainForTenant.mockRejectedValue('valeur brute levée')

    const result = await handler({})

    expect(result.registersErrored).toBe(1)
    const [, ctx] = captureMessage.mock.calls[0] as [string, { extra: Record<string, unknown> }]
    expect(ctx.extra.errorName).toBe('UnknownError')
    expect(JSON.stringify(ctx)).not.toContain('valeur brute')
  })

  it('si la liste des caisses actives est illisible, le cron ÉCHOUE au lieu de répondre « rien à vérifier »', async () => {
    // Cette requête est hors du try par caisse, à dessein : sans elle on ne sait
    // même pas quoi vérifier. Le handler doit rejeter (500, run en échec côté
    // Vercel, erreur capturée par Sentry) — surtout pas un 200 « 0 caisse ».
    activeRegistersError = new Error('connection terminated')

    await expect(handler({})).rejects.toThrow('connection terminated')
    expect(verifyChainForTenant).not.toHaveBeenCalled()
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
