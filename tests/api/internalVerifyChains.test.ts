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

// Contrôles de bord de journée (raccord avec la veille, comparaison à la
// clôture) : mockés ici, testés pour eux-mêmes dans tests/unit/chainDayBoundaries.test.ts.
// Par défaut « rien à signaler, clôture présente » : les tests antérieurs à ce
// contrôle gardent ainsi exactement leurs assertions d'origine.
const checkDayBoundaries = vi.fn()
vi.mock('~/server/utils/chainDayBoundaries', () => ({
  checkDayBoundaries: (...args: unknown[]) => checkDayBoundaries(...args),
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
}))

vi.mock('~/server/database/schema', () => ({
  sales: { __t: 'sales', tenantId: 'tenantId', registerId: 'registerId', saleDate: 'saleDate' },
  closures: { __t: 'closures', tenantId: 'tenantId', registerId: 'registerId', closureDate: 'closureDate', createdAt: 'createdAt' },
}))

let activeRegisters: Array<{ tenantId: string; registerId: number | null }> = []
/** Si renseignée, la requête des caisses actives échoue avec cette erreur. */
let activeRegistersError: Error | null = null
/** Caisses ayant une clôture ce jour-là (2e requête du handler, sur `closures`). */
let closedRegisters: Array<{ tenantId: string; registerId: number }> = []
let closedRegistersError: Error | null = null
/**
 * Clôtures tardives (3e requête du handler, sur `closures` aussi) : enregistrées
 * depuis le début de la veille mais portant sur un jour plus ancien. Distinguée
 * de la précédente par la forme de son filtre (`and(...)` au lieu de `eq(...)`).
 */
let lateClosures: Array<{ tenantId: string; registerId: number; closureDate: string }> = []
let lateClosuresError: Error | null = null
/** Conditions `where` reçues, par liste — pour vérifier sur quoi porte chacune. */
let whereByTable: Record<string, unknown> = {}
vi.mock('~/server/database/connection', () => ({
  db: {
    selectDistinct: () => ({
      from: (table: { __t: string }) => ({
        where: (cond: unknown) => {
          if (table.__t === 'closures' && (cond as { type?: string })?.type === 'and') {
            whereByTable.lateClosures = cond
            return lateClosuresError ? Promise.reject(lateClosuresError) : Promise.resolve(lateClosures)
          }
          whereByTable[table.__t] = cond
          if (table.__t === 'closures') {
            return closedRegistersError ? Promise.reject(closedRegistersError) : Promise.resolve(closedRegisters)
          }
          return activeRegistersError ? Promise.reject(activeRegistersError) : Promise.resolve(activeRegisters)
        },
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
    checkDayBoundaries.mockReset()
    checkDayBoundaries.mockResolvedValue({ anomalies: [], hasClosure: true })
    activeRegisters = []
    activeRegistersError = null
    closedRegisters = []
    closedRegistersError = null
    lateClosures = []
    lateClosuresError = null
    whereByTable = {}

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

  // ==========================================
  // Bords de la journée (bloquant n°2, 2026-11-11) : raccord avec la veille,
  // comparaison à la clôture, journée entièrement effacée.
  // ==========================================

  describe('bords de la journée', () => {
    type Ctx = { level: string; tags: Record<string, string>; extra: Record<string, unknown> }
    type Summary = { registersWithoutClosure: number }

    const linkBroken = { kind: 'previous_day_link_broken', ticketNumber: '20260909-E01-R03-000101' }
    const lastMissing = { kind: 'closure_last_ticket_missing', ticketNumber: '20260909-E01-R03-000112' }
    const countMismatch = { kind: 'closure_count_mismatch', expected: 12, found: 0 }

    it('contrôle les bords de chaque caisse, sur le même jour métier et la même fenêtre que le contenu', async () => {
      activeRegisters = [
        { tenantId: 'tenant-1', registerId: 1 },
        { tenantId: 'tenant-2', registerId: 9 },
      ]
      verifyChainForTenant.mockResolvedValue(valid(3))

      await handler({})

      expect(checkDayBoundaries).toHaveBeenCalledTimes(2)
      expect(checkDayBoundaries.mock.calls.map(c => [c[0], c[1], c[2]])).toEqual([
        ['tenant-1', 1, '2026-09-09'],
        ['tenant-2', 9, '2026-09-09'],
      ])
      for (let i = 0; i < 2; i++) {
        const bounds = checkDayBoundaries.mock.calls[i]![3] as { start: Date; end: Date }
        const chainOptions = verifyChainForTenant.mock.calls[i]![1] as { from: Date; to: Date }
        expect(bounds.start).toBe(chainOptions.from)
        expect(bounds.end).toBe(chainOptions.to)
      }
    })

    it('raccord cassé avec la veille : chaîne déclarée cassée alors que le contenu du jour est intact', async () => {
      activeRegisters = [{ tenantId: 'tenant-1', registerId: 3 }]
      verifyChainForTenant.mockResolvedValue(valid(12))
      checkDayBoundaries.mockResolvedValue({ anomalies: [linkBroken], hasClosure: true })

      const result = await handler({})

      expect(result).toMatchObject({ registersChecked: 1, registersFailed: 1, registersErrored: 0 })
      expect(captureMessage).toHaveBeenCalledTimes(1)
      const [message, ctx] = captureMessage.mock.calls[0] as [string, Ctx]
      expect(message).toBe('NF525 : chaîne de tickets cassée')
      expect(ctx.level).toBe('error')
      expect(ctx.extra.boundaryAnomalies).toEqual([linkBroken])
      expect(ctx.extra.brokenTicketNumbers).toEqual([])

      // Trace d'audit « intégrité en échec » : elle porte le jour et la nature
      // du constat (seul enregistrement durable — Sentry et les logs expirent).
      // `brokenLinksCount` reste le nombre de tickets cassés : ici aucun.
      expect(logChainVerification).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-1',
        registerId: 3,
        isValid: false,
        ticketCount: 12,
        brokenLinksCount: 0,
        businessDay: '2026-09-09',
        boundaryAnomalies: ['previous_day_link_broken'],
      }))
    })

    it('journée effacée : une caisse SANS vente mais AVEC clôture est contrôlée et alertée', async () => {
      // Plus aucune vente ce jour-là : la caisse n'apparaît que par sa clôture.
      activeRegisters = []
      closedRegisters = [{ tenantId: 'tenant-1', registerId: 3 }]
      verifyChainForTenant.mockResolvedValue(valid(0))
      checkDayBoundaries.mockResolvedValue({ anomalies: [lastMissing, countMismatch], hasClosure: true })

      const result = await handler({})

      expect(verifyChainForTenant).toHaveBeenCalledTimes(1)
      expect(checkDayBoundaries).toHaveBeenCalledWith('tenant-1', 3, '2026-09-09', expect.anything())
      expect(result).toMatchObject({ registersChecked: 1, ticketsChecked: 0, registersFailed: 1 })

      expect(captureMessage).toHaveBeenCalledTimes(1)
      const [, ctx] = captureMessage.mock.calls[0] as [string, Ctx]
      expect(ctx.extra.boundaryAnomalies).toEqual([lastMissing, countMismatch])

      // Même avec 0 ticket restant, l'anomalie laisse une ligne d'audit.
      expect(logChainVerification).toHaveBeenCalledWith(expect.objectContaining({
        isValid: false,
        ticketCount: 0,
        brokenLinksCount: 0,
        businessDay: '2026-09-09',
        boundaryAnomalies: ['closure_last_ticket_missing', 'closure_count_mismatch'],
      }))
    })

    it('la liste des clôtures porte sur le jour métier vérifié', async () => {
      await handler({})

      expect(whereByTable.closures).toEqual({ type: 'eq', args: ['closureDate', '2026-09-09'] })
    })

    it('une caisse présente dans les ventes ET dans les clôtures n’est vérifiée qu’une fois', async () => {
      activeRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
      closedRegisters = [
        { tenantId: 'tenant-1', registerId: 1 },
        { tenantId: 'tenant-1', registerId: 2 },
        // Même numéro de caisse chez un autre commerçant : caisse distincte.
        { tenantId: 'tenant-2', registerId: 1 },
      ]
      verifyChainForTenant.mockResolvedValue(valid(4))

      const result = await handler({})

      expect(verifyChainForTenant.mock.calls.map(c => [c[0], c[1].registerId])).toEqual([
        ['tenant-1', 1],
        ['tenant-1', 2],
        ['tenant-2', 1],
      ])
      expect(result.registersChecked).toBe(3)
    })

    it('contenu cassé ET bord cassé sur la même caisse : UNE alerte qui porte les deux', async () => {
      activeRegisters = [{ tenantId: 'tenant-1', registerId: 3 }]
      verifyChainForTenant.mockResolvedValue(broken(5, ['20260909-E01-R03-000104']))
      checkDayBoundaries.mockResolvedValue({ anomalies: [linkBroken], hasClosure: true })

      const result = await handler({})

      expect(result.registersFailed).toBe(1)
      expect(captureMessage).toHaveBeenCalledTimes(1)
      const [, ctx] = captureMessage.mock.calls[0] as [string, Ctx]
      expect(ctx.extra.brokenTicketNumbers).toEqual(['20260909-E01-R03-000104'])
      expect(ctx.extra.boundaryAnomalies).toEqual([linkBroken])
      expect(logChainVerification).toHaveBeenCalledWith(expect.objectContaining({
        isValid: false,
        brokenLinksCount: 1,
        boundaryAnomalies: ['previous_day_link_broken'],
      }))
    })

    it('si le contrôle de bord plante, la caisse est « non vérifiée », jamais intacte', async () => {
      activeRegisters = [
        { tenantId: 'tenant-1', registerId: 1 },
        { tenantId: 'tenant-1', registerId: 2 },
      ]
      verifyChainForTenant.mockResolvedValue(valid(4))
      checkDayBoundaries
        .mockRejectedValueOnce(new Error('connection terminated'))
        .mockResolvedValueOnce({ anomalies: [], hasClosure: true })

      const result = await handler({})

      expect(result).toMatchObject({ registersChecked: 1, registersFailed: 0, registersErrored: 1 })
      expect(captureMessage).toHaveBeenCalledTimes(1)
      expect(captureMessage.mock.calls[0]![0]).toBe('NF525 : vérification de chaîne impossible')
      // Pas de ligne d'audit « chaîne valide » pour la caisse dont on ne sait rien.
      expect(logChainVerification).toHaveBeenCalledTimes(1)
      expect(logChainVerification).toHaveBeenCalledWith(expect.objectContaining({ registerId: 2, isValid: true }))
    })

    it('contenu cassé PUIS contrôle de bord qui plante : la rupture établie n’est pas perdue', async () => {
      // Relecture du 2026-11-11 : sans ce cas, une chaîne déjà reconnue cassée
      // était rétrogradée en « vérification impossible », sans numéros de ticket
      // ni ligne d'audit. Pire : une panne systématique du contrôle de bord
      // aurait masqué toutes les ruptures de contenu, chaque nuit.
      activeRegisters = [{ tenantId: 'tenant-1', registerId: 3 }]
      verifyChainForTenant.mockResolvedValue(broken(5, ['20260909-E01-R03-000104']))
      checkDayBoundaries.mockRejectedValue(new Error('connection terminated'))

      const result = await handler({})

      // Cassée (c'est établi) ET non vérifiée (les bords n'ont pas pu l'être).
      expect(result).toMatchObject({ registersChecked: 1, registersFailed: 1, registersErrored: 1 })

      const messages = captureMessage.mock.calls.map(c => c[0] as string)
      expect(messages).toEqual([
        'NF525 : chaîne de tickets cassée',
        'NF525 : vérification de chaîne impossible',
      ])
      const [, ctx] = captureMessage.mock.calls[0] as [string, Ctx]
      expect(ctx.extra.brokenTicketNumbers).toEqual(['20260909-E01-R03-000104'])
      expect(ctx.extra).not.toHaveProperty('boundaryAnomalies')

      expect(logChainVerification).toHaveBeenCalledTimes(1)
      expect(logChainVerification).toHaveBeenCalledWith(expect.objectContaining({
        isValid: false,
        ticketCount: 5,
        brokenLinksCount: 1,
        boundaryAnomalies: [],
      }))
    })

    it('contenu intact et contrôle de bord qui plante : aucune ligne « chaîne cassée » inventée', async () => {
      activeRegisters = [{ tenantId: 'tenant-1', registerId: 3 }]
      verifyChainForTenant.mockResolvedValue(valid(5))
      checkDayBoundaries.mockRejectedValue(new Error('connection terminated'))

      const result = await handler({})

      expect(result).toMatchObject({ registersChecked: 0, registersFailed: 0, registersErrored: 1 })
      expect(logChainVerification).not.toHaveBeenCalled()
      expect(captureMessage.mock.calls.map(c => c[0])).toEqual(['NF525 : vérification de chaîne impossible'])
    })

    describe('clôture faite en retard', () => {
      // Parcours normal d'un oubli : la journée du 08 est clôturée le 09 ou le
      // 10 au matin. Le cron qui visait le 08 l'a vue « sans clôture » ; sans
      // reprise, le 08 ne serait plus jamais confronté à sa clôture.
      type LateSummary = { lateClosuresChecked: number; registersChecked: number; registersFailed: number }

      it('reprend la journée ancienne, sur SES bornes, contenu et bords', async () => {
        lateClosures = [{ tenantId: 'tenant-1', registerId: 3, closureDate: '2026-09-08' }]
        verifyChainForTenant.mockResolvedValue(valid(9))

        const result = await handler({}) as unknown as LateSummary

        expect(result).toMatchObject({ lateClosuresChecked: 1, registersChecked: 1, registersFailed: 0 })

        // 2026-09-08 à Paris (UTC+2) : de 2026-09-07 22:00Z à 2026-09-08 22:00Z.
        const expectedBounds = { start: new Date('2026-09-07T22:00:00Z'), end: new Date('2026-09-08T22:00:00Z') }
        expect(checkDayBoundaries).toHaveBeenCalledWith('tenant-1', 3, '2026-09-08', expectedBounds)
        const chainOptions = verifyChainForTenant.mock.calls[0]![1] as { registerId: number; from: Date; to: Date }
        expect(chainOptions).toMatchObject({ registerId: 3, from: expectedBounds.start, to: expectedBounds.end })
      })

      it('ne retient que les clôtures enregistrées depuis le début de la veille, pour un jour antérieur', async () => {
        await handler({})

        // Veille = 2026-09-09 à Paris, qui commence le 2026-09-08 à 22:00Z.
        expect(whereByTable.lateClosures).toEqual({
          type: 'and',
          args: [
            { type: 'gte', args: ['createdAt', new Date('2026-09-08T22:00:00Z')] },
            { type: 'lt', args: ['closureDate', '2026-09-09'] },
          ],
        })
      })

      it('fin de journée tronquée après une clôture tardive : alerte datée du jour concerné', async () => {
        activeRegisters = [{ tenantId: 'tenant-1', registerId: 3 }]
        lateClosures = [{ tenantId: 'tenant-1', registerId: 3, closureDate: '2026-09-08' }]
        verifyChainForTenant.mockResolvedValue(valid(9))
        checkDayBoundaries.mockImplementation(async (_tenant: string, _register: number, day: string) =>
          day === '2026-09-08'
            ? { anomalies: [lastMissing, countMismatch], hasClosure: true }
            : { anomalies: [], hasClosure: true })

        const result = await handler({}) as unknown as LateSummary

        // La même caisse est contrôlée pour deux jours : la veille (saine) et le 08 (tronqué).
        expect(result).toMatchObject({ registersChecked: 2, registersFailed: 1, lateClosuresChecked: 1 })
        expect(captureMessage).toHaveBeenCalledTimes(1)
        const [, ctx] = captureMessage.mock.calls[0] as [string, Ctx]
        expect(ctx.extra.businessDay).toBe('2026-09-08')
        expect(ctx.extra.boundaryAnomalies).toEqual([lastMissing, countMismatch])
        expect(logChainVerification).toHaveBeenCalledWith(expect.objectContaining({
          isValid: false,
          businessDay: '2026-09-08',
        }))
        expect(logChainVerification).toHaveBeenCalledWith(expect.objectContaining({
          isValid: true,
          businessDay: '2026-09-09',
        }))
      })

      it('deux jours cassés sur la même caisse dans le même passage : deux alertes, pas une étouffée', async () => {
        activeRegisters = [{ tenantId: 'tenant-1', registerId: 3 }]
        lateClosures = [{ tenantId: 'tenant-1', registerId: 3, closureDate: '2026-09-08' }]
        verifyChainForTenant.mockResolvedValue(valid(9))
        checkDayBoundaries.mockResolvedValue({ anomalies: [linkBroken], hasClosure: true })

        await handler({})

        expect(captureMessage).toHaveBeenCalledTimes(2)
        const days = captureMessage.mock.calls.map(c => (c[1] as Ctx).extra.businessDay)
        expect(days).toEqual(['2026-09-09', '2026-09-08'])
      })

      it('une clôture tardive au jour illisible est comptée « non vérifiée », le balayage continue', async () => {
        activeRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
        lateClosures = [{ tenantId: 'tenant-1', registerId: 3, closureDate: 'pas-une-date' }]
        verifyChainForTenant.mockResolvedValue(valid(4))

        const result = await handler({})

        expect(result).toMatchObject({ registersChecked: 1, registersErrored: 1 })
      })

      it('si la liste des clôtures tardives est illisible, le cron ÉCHOUE', async () => {
        activeRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
        lateClosuresError = new Error('connection terminated')

        await expect(handler({})).rejects.toThrow('connection terminated')
        expect(verifyChainForTenant).not.toHaveBeenCalled()
      })
    })

    it('si la liste des clôtures est illisible, le cron ÉCHOUE au lieu de répondre « rien à signaler »', async () => {
      activeRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
      closedRegistersError = new Error('connection terminated')

      await expect(handler({})).rejects.toThrow('connection terminated')
      expect(verifyChainForTenant).not.toHaveBeenCalled()
    })

    it('caisse ayant encaissé sans clôture : comptée dans le résumé, sans alerte', async () => {
      activeRegisters = [
        { tenantId: 'tenant-1', registerId: 1 },
        { tenantId: 'tenant-1', registerId: 2 },
      ]
      verifyChainForTenant.mockResolvedValue(valid(6))
      checkDayBoundaries
        .mockResolvedValueOnce({ anomalies: [], hasClosure: false })
        .mockResolvedValueOnce({ anomalies: [], hasClosure: true })

      const result = await handler({}) as unknown as Summary & { registersFailed: number }

      expect(result.registersWithoutClosure).toBe(1)
      expect(result.registersFailed).toBe(0)
      expect(captureMessage).not.toHaveBeenCalled()
    })

    it('toujours ni audit ni alerte pour une caisse sans ticket et sans anomalie', async () => {
      // Clôture d'une journée vide : la caisse est contrôlée, il n'y a rien à dire.
      closedRegisters = [{ tenantId: 'tenant-1', registerId: 1 }]
      verifyChainForTenant.mockResolvedValue(valid(0))

      const result = await handler({}) as unknown as Summary & { registersFailed: number; registersChecked: number }

      expect(result).toMatchObject({ registersChecked: 1, registersFailed: 0, registersWithoutClosure: 0 })
      expect(logChainVerification).not.toHaveBeenCalled()
      expect(captureMessage).not.toHaveBeenCalled()
    })
  })
})
