import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const captureMessage = vi.fn()

vi.mock('@sentry/nuxt', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}))

import { reportRateLimitExceeded, _resetReporterForTests } from '~/server/utils/rateLimitReporter'

interface CapturedContext {
  level: string
  tags: Record<string, string | undefined>
  extra: Record<string, unknown>
}

function getCall(index: number): [string, CapturedContext] {
  const call = captureMessage.mock.calls[index]
  if (!call) throw new Error(`No captureMessage call at index ${index}`)
  return call as [string, CapturedContext]
}

const basePayload = {
  key: 'auth:tenant-1:user-1:read',
  category: 'read',
  isPublic: false,
  path: '/api/clients',
  method: 'GET',
  limit: 300,
  windowMs: 60_000,
  retryAfterSec: 12,
  tenantId: 'tenant-1',
  userId: 'user-1',
  ip: '203.0.113.4',
}

describe('C2 — reportRateLimitExceeded', () => {
  beforeEach(() => {
    _resetReporterForTests()
    captureMessage.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-16T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('envoie un event Sentry sur le premier dépassement', () => {
    const sent = reportRateLimitExceeded(basePayload)
    expect(sent).toBe(true)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [message, ctx] = getCall(0)
    expect(message).toBe('Rate limit exceeded: read')
    expect(ctx.level).toBe('warning')
    expect(ctx.tags).toMatchObject({ scope: 'rate-limit', category: 'read', tenantId: 'tenant-1' })
  })

  it('throttle : second dépassement même clé dans la fenêtre = pas d\'envoi', () => {
    reportRateLimitExceeded(basePayload)
    captureMessage.mockClear()

    vi.advanceTimersByTime(30_000) // < 60s
    const sent = reportRateLimitExceeded(basePayload)

    expect(sent).toBe(false)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('relâche le throttle après THROTTLE_MS (60s)', () => {
    reportRateLimitExceeded(basePayload)
    captureMessage.mockClear()

    vi.advanceTimersByTime(60_001)
    const sent = reportRateLimitExceeded(basePayload)

    expect(sent).toBe(true)
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })

  it('isole le throttle par clé (clés différentes = events indépendants)', () => {
    reportRateLimitExceeded(basePayload)
    reportRateLimitExceeded({ ...basePayload, key: 'auth:tenant-2:user-9:read', tenantId: 'tenant-2', userId: 'user-9' })
    expect(captureMessage).toHaveBeenCalledTimes(2)
  })

  it('hash userId et IP, ne les envoie pas en clair', () => {
    reportRateLimitExceeded(basePayload)
    const [, ctx] = getCall(0)
    const extraJson = JSON.stringify(ctx.extra)
    expect(extraJson).not.toContain('user-1')
    expect(extraJson).not.toContain('203.0.113.4')
    expect(ctx.extra.userHash).toMatch(/^[a-f0-9]{12}$/)
    expect(ctx.extra.ipHash).toMatch(/^[a-f0-9]{12}$/)
    expect(ctx.extra.keyHash).toMatch(/^[a-f0-9]{12}$/)
  })

  it('garde le tenantId en clair (utile pour grouper Sentry, non PII)', () => {
    reportRateLimitExceeded(basePayload)
    const [, ctx] = getCall(0)
    expect(ctx.tags.tenantId).toBe('tenant-1')
  })

  it('omet tenantId/userId/ip si null (endpoint public sans auth)', () => {
    reportRateLimitExceeded({
      ...basePayload,
      key: 'ip:unknown:/api/login',
      category: 'public',
      isPublic: true,
      path: '/api/login',
      method: 'POST',
      tenantId: null,
      userId: null,
      ip: null,
    })
    const [, ctx] = getCall(0)
    expect(ctx.tags.tenantId).toBeUndefined()
    expect(ctx.tags.isPublic).toBe('true')
    expect(ctx.extra.userHash).toBeUndefined()
    expect(ctx.extra.ipHash).toBeUndefined()
  })

  it('expose limit/windowMs/retryAfterSec en extras', () => {
    reportRateLimitExceeded(basePayload)
    const [, ctx] = getCall(0)
    expect(ctx.extra).toMatchObject({
      path: '/api/clients',
      method: 'GET',
      limit: 300,
      windowMs: 60_000,
      retryAfterSec: 12,
    })
  })
})
