import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { scrubSentryEvent } from '~/server/utils/sentryScrub'

/**
 * Nettoyage des événements Sentry avant envoi (relecture A5, 2026-11-11).
 *
 * Sans ce filtre, le SDK joint à chaque événement serveur les en-têtes, les
 * cookies et le corps de la requête en cours : jeton de session, CRON_SECRET,
 * contenu d'une vente ou d'une fiche client partiraient chez un tiers.
 */

describe('scrubSentryEvent', () => {
  it.each([
    ['authorization', 'Bearer jeton-de-session'],
    ['Authorization', 'Bearer le-cron-secret'],
    ['AUTHORIZATION', 'Bearer x'],
    ['proxy-authorization', 'Basic abc'],
    ['cookie', 'sb-access-token=abc'],
    ['Cookie', 'sb-access-token=abc'],
    ['set-cookie', 'sb-access-token=abc'],
    ['x-cron-secret', 'le-cron-secret'],
    ['X-Cron-Secret', 'le-cron-secret'],
  ])('retire l’en-tête sensible « %s »', (name, value) => {
    const event = { request: { headers: { [name]: value, 'user-agent': 'vitest' } } }

    scrubSentryEvent(event)

    expect(event.request.headers).toEqual({ 'user-agent': 'vitest' })
    expect(JSON.stringify(event)).not.toContain(value)
  })

  it.each([
    'x-supabase-token',
    'x-api-key',
    'apikey',
    'x-webhook-secret',
    'x-admin-password',
  ])('retire par motif un en-tête sensible non listé : « %s »', (name) => {
    const event = { request: { headers: { [name]: 'valeur-sensible' } } }

    scrubSentryEvent(event)

    expect(event.request.headers).toEqual({})
  })

  // Le SDK 10.50 est censé retirer ces en-têtes quand sendDefaultPii est faux,
  // mais compare des noms en casse titre à des clés en minuscules : rien ne part.
  it.each([
    'x-forwarded-for',
    'x-real-ip',
    'x-vercel-forwarded-for',
    'forwarded',
    'cf-connecting-ip',
    'X-Real-IP',
  ])('retire l’en-tête d’adresse IP « %s »', (name) => {
    const event = { request: { headers: { [name]: '203.0.113.4', 'user-agent': 'vitest' } } }

    scrubSentryEvent(event)

    expect(event.request.headers).toEqual({ 'user-agent': 'vitest' })
  })

  it('nettoie les attributs de trace : IP, cookies quel que soit leur nom, en-têtes sensibles', () => {
    const traceData = () => ({
      'http.method': 'GET',
      'http.target': '/api/clients',
      'http.client_ip': '203.0.113.4',
      'http.request.header.x_real_ip': '203.0.113.4',
      'http.request.header.x_vercel_forwarded_for': '203.0.113.4',
      'http.request.header.authorization': '[Filtered]',
      'http.request.header.x_cron_secret': '[Filtered]',
      'http.request.header.cookie.sb_access_token': '[Filtered]',
      'http.request.header.cookie.panier': 'valeur-au-nom-anodin',
      'http.response.header.set_cookie.prefs': 'valeur',
      'http.request.header.user_agent': 'Mozilla/5.0',
      'http.request.header.x_tenant_id': 'tenant-1',
    })
    const event = {
      contexts: { trace: { trace_id: 'abc', data: traceData() } },
      spans: [{ description: 'db', data: traceData() }, { description: 'sans data' }],
    }

    scrubSentryEvent(event)

    const expected = {
      'http.method': 'GET',
      'http.target': '/api/clients',
      'http.request.header.user_agent': 'Mozilla/5.0',
      'http.request.header.x_tenant_id': 'tenant-1',
    }
    expect(event.contexts.trace).toEqual({ trace_id: 'abc', data: expected })
    expect(event.spans).toEqual([{ description: 'db', data: expected }, { description: 'sans data' }])
    expect(JSON.stringify(event)).not.toContain('203.0.113.4')
  })

  it('conserve les en-têtes utiles au diagnostic', () => {
    const headers = {
      'user-agent': 'Mozilla/5.0',
      'x-tenant-id': 'tenant-1',
      'content-type': 'application/json',
      'accept-language': 'fr-FR',
      'x-vercel-id': 'cdg1::abc',
    }
    const event = { request: { headers: { ...headers, authorization: 'Bearer x' } } }

    scrubSentryEvent(event)

    expect(event.request.headers).toEqual(headers)
  })

  it('retire les cookies déjà analysés et le corps de la requête', () => {
    const event = {
      request: {
        url: 'https://exemple.test/api/clients',
        method: 'POST',
        query_string: 'page=2',
        headers: {},
        cookies: { 'sb-access-token': 'abc' },
        data: { name: 'Jeanne Dupont', phone: '0600000000' },
      },
    }

    scrubSentryEvent(event)

    expect(event.request).toEqual({
      url: 'https://exemple.test/api/clients',
      method: 'POST',
      query_string: 'page=2',
      headers: {},
    })
  })

  it('ne touche pas au reste de l’événement', () => {
    const event = {
      message: 'NF525 : chaîne de tickets cassée',
      level: 'error',
      tags: { tenantId: 'tenant-1' },
      extra: { registerId: 3 },
      request: { headers: { authorization: 'Bearer x' } },
    }

    const result = scrubSentryEvent(event)

    expect(result).toBe(event)
    expect(result).toMatchObject({
      message: 'NF525 : chaîne de tickets cassée',
      level: 'error',
      tags: { tenantId: 'tenant-1' },
      extra: { registerId: 3 },
    })
  })

  it('accepte un événement sans requête, ou une requête sans en-têtes', () => {
    // Message émis hors requête HTTP (tâche de fond) : pas de champ `request`.
    const withoutRequest: { message: string; request?: undefined } = { message: 'hors requête' }
    expect(scrubSentryEvent(withoutRequest)).toEqual({ message: 'hors requête' })
    expect(scrubSentryEvent({ request: {} })).toEqual({ request: {} })
    expect(scrubSentryEvent({ request: { headers: undefined } })).toEqual({ request: { headers: undefined } })
  })

  it('ne lève jamais : sur un imprévu, toute la partie requête est supprimée', () => {
    const headers = Object.freeze({ authorization: 'Bearer le-cron-secret' })
    const event: { request?: { headers?: Record<string, unknown> } } = { request: { headers } }

    expect(() => scrubSentryEvent(event)).not.toThrow()
    expect(event.request).toBeUndefined()
  })

  it('ne lève jamais non plus sur des attributs de trace figés : ils sont supprimés en bloc', () => {
    const data = Object.freeze({ 'http.client_ip': '203.0.113.4' })
    const event: { contexts: { trace: { data?: unknown } }; spans?: Array<{ data?: unknown }> } = {
      contexts: { trace: { data } },
      spans: [{ data }],
    }

    expect(() => scrubSentryEvent(event)).not.toThrow()
    expect(event.contexts.trace.data).toBeUndefined()
    expect(event.spans).toBeUndefined()
  })

  it('tolère des formes inattendues sans lever (en-têtes non objet, spans non tableau)', () => {
    const odd = { request: { headers: 'pas un objet' }, spans: 'pas un tableau', contexts: { trace: { data: 42 } } }
    expect(() => scrubSentryEvent(odd as never)).not.toThrow()
  })
})

describe('sentry.server.config — branchement du nettoyage', () => {
  const init = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    init.mockReset()
    vi.doMock('@sentry/nuxt', () => ({ init: (...args: unknown[]) => init(...args) }))
  })

  afterEach(() => {
    vi.doUnmock('@sentry/nuxt')
    vi.unstubAllEnvs()
  })

  it('branche le nettoyage sur les erreurs/messages ET sur les traces', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://public@o0.ingest.sentry.io/0')

    await import('../../sentry.server.config')

    expect(init).toHaveBeenCalledTimes(1)
    const options = init.mock.calls[0]?.[0] as {
      beforeSend: (event: unknown) => unknown
      beforeSendTransaction: (event: unknown) => unknown
      sendDefaultPii: boolean
    }
    expect(options.sendDefaultPii).toBe(false)

    for (const hook of [options.beforeSend, options.beforeSendTransaction]) {
      const event = {
        request: {
          headers: { 'authorization': 'Bearer le-cron-secret', 'user-agent': 'vercel-cron/1.0' },
          data: { any: 'body' },
        },
      }
      expect(hook(event)).toEqual({ request: { headers: { 'user-agent': 'vercel-cron/1.0' } } })
    }
  })

  it('n’initialise pas Sentry sans DSN', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('NUXT_PUBLIC_SENTRY_DSN', '')

    await import('../../sentry.server.config')

    expect(init).not.toHaveBeenCalled()
  })
})
