import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const captureMessage = vi.fn()

vi.mock('@sentry/nuxt', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}))

import handler from '~/server/middleware/rateLimit.global'
import { _resetForTests as resetLimiter } from '~/server/utils/rateLimiter'
import { _resetReporterForTests } from '~/server/utils/rateLimitReporter'

interface MockEvent {
  path: string
  method: string
  context: { auth?: { tenantId?: string; user?: { id?: string }; accessToken?: string } }
}

function makeEvent(opts: {
  path: string
  method?: string
  tenantId?: string
  userId?: string
}): MockEvent {
  const ev: MockEvent = {
    path: opts.path,
    method: opts.method || 'GET',
    context: {},
  }
  if (opts.tenantId && opts.userId) {
    ev.context.auth = { tenantId: opts.tenantId, user: { id: opts.userId }, accessToken: 't' }
  }
  return ev
}

describe('C2 — rateLimit.global middleware', () => {
  let setResponseHeaderSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetLimiter()
    _resetReporterForTests()
    captureMessage.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-16T10:00:00Z'))

    setResponseHeaderSpy = vi.fn()
    vi.stubGlobal('setResponseHeader', setResponseHeaderSpy)
    vi.stubGlobal('getRequestIP', vi.fn(() => '203.0.113.4'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('ignore les routes hors /api', async () => {
    await handler(makeEvent({ path: '/dashboard' }) as never)
    expect(setResponseHeaderSpy).not.toHaveBeenCalled()
  })

  it('ignore la méthode OPTIONS (preflight CORS)', async () => {
    await handler(makeEvent({ path: '/api/clients', method: 'OPTIONS', tenantId: 't1', userId: 'u1' }) as never)
    expect(setResponseHeaderSpy).not.toHaveBeenCalled()
  })

  it('pose les headers X-RateLimit-* sur les requêtes autorisées', async () => {
    await handler(makeEvent({ path: '/api/clients', method: 'GET', tenantId: 't1', userId: 'u1' }) as never)
    const headerNames = setResponseHeaderSpy.mock.calls.map((c) => c[1])
    expect(headerNames).toContain('X-RateLimit-Limit')
    expect(headerNames).toContain('X-RateLimit-Remaining')
    expect(headerNames).toContain('X-RateLimit-Reset')
  })

  it('GET authentifié : catégorie read, limit 300', async () => {
    await handler(makeEvent({ path: '/api/clients', method: 'GET', tenantId: 't1', userId: 'u1' }) as never)
    const limitCall = setResponseHeaderSpy.mock.calls.find((c) => c[1] === 'X-RateLimit-Limit')
    expect(limitCall?.[2]).toBe('300')
  })

  it('POST authentifié générique : catégorie mutation, limit 60', async () => {
    await handler(makeEvent({ path: '/api/products', method: 'POST', tenantId: 't1', userId: 'u1' }) as never)
    const limitCall = setResponseHeaderSpy.mock.calls.find((c) => c[1] === 'X-RateLimit-Limit')
    expect(limitCall?.[2]).toBe('60')
  })

  it('POST /api/sales/create : catégorie sales-create, limit 30', async () => {
    await handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never)
    const limitCall = setResponseHeaderSpy.mock.calls.find((c) => c[1] === 'X-RateLimit-Limit')
    expect(limitCall?.[2]).toBe('30')
  })

  it('endpoint public (login) sans auth : catégorie public, limit 5, clé par IP', async () => {
    await handler(makeEvent({ path: '/api/login', method: 'POST' }) as never)
    const limitCall = setResponseHeaderSpy.mock.calls.find((c) => c[1] === 'X-RateLimit-Limit')
    expect(limitCall?.[2]).toBe('5')
  })

  it('isole les compteurs par tenant (cross-tenant safety)', async () => {
    // Saturer t1
    for (let i = 0; i < 30; i++) {
      await handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never)
    }
    // t2 doit toujours pouvoir passer
    await expect(
      handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't2', userId: 'u2' }) as never),
    ).resolves.toBeUndefined()
  })

  it('jette 429 + Retry-After quand la limite est dépassée', async () => {
    for (let i = 0; i < 30; i++) {
      await handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never)
    }
    await expect(
      handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never),
    ).rejects.toMatchObject({ __isError: true, statusCode: 429 })

    const retryAfter = setResponseHeaderSpy.mock.calls.find((c) => c[1] === 'Retry-After')
    expect(retryAfter).toBeDefined()
  })

  it('remonte un event Sentry sur dépassement avec tags pertinents', async () => {
    for (let i = 0; i < 30; i++) {
      await handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never)
    }
    await expect(
      handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never),
    ).rejects.toBeDefined()

    expect(captureMessage).toHaveBeenCalledTimes(1)
    const firstCall = captureMessage.mock.calls[0] as [string, { tags: Record<string, unknown> }]
    expect(firstCall[0]).toBe('Rate limit exceeded: sales-create')
    expect(firstCall[1].tags).toMatchObject({ scope: 'rate-limit', category: 'sales-create', tenantId: 't1' })
  })

  it('throttle Sentry : 2 dépassements rapprochés même clé = 1 seul event', async () => {
    for (let i = 0; i < 30; i++) {
      await handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never)
    }
    // 2 dépassements consécutifs
    await expect(
      handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never),
    ).rejects.toBeDefined()
    await expect(
      handler(makeEvent({ path: '/api/sales/create', method: 'POST', tenantId: 't1', userId: 'u1' }) as never),
    ).rejects.toBeDefined()

    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})
