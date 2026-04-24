import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkLimit, _resetForTests } from '~/server/utils/rateLimiter'

describe('Q10 — rateLimiter.checkLimit', () => {
  beforeEach(() => {
    _resetForTests()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('autorise la première requête et décrémente remaining', () => {
    const r = checkLimit('user-a', 5, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
    expect(r.limit).toBe(5)
    expect(r.retryAfterSec).toBe(0)
  })

  it('autorise jusqu\'à la limite (inclus)', () => {
    for (let i = 0; i < 5; i++) {
      const r = checkLimit('user-a', 5, 60_000)
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBe(5 - i - 1)
    }
  })

  it('refuse au-delà de la limite avec retryAfterSec > 0', () => {
    for (let i = 0; i < 5; i++) checkLimit('user-a', 5, 60_000)
    const r = checkLimit('user-a', 5, 60_000)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
    expect(r.retryAfterSec).toBeGreaterThan(0)
    expect(r.retryAfterSec).toBeLessThanOrEqual(60)
  })

  it('réinitialise le compteur quand la window est expirée', () => {
    for (let i = 0; i < 5; i++) checkLimit('user-a', 5, 60_000)
    expect(checkLimit('user-a', 5, 60_000).allowed).toBe(false)

    // Avance après la fin de la window
    vi.advanceTimersByTime(60_001)

    const r = checkLimit('user-a', 5, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
  })

  it('isole les compteurs par clé (cross-tenant safety)', () => {
    for (let i = 0; i < 5; i++) checkLimit('user-a', 5, 60_000)
    expect(checkLimit('user-a', 5, 60_000).allowed).toBe(false)

    // user-b doit être indépendant
    const r = checkLimit('user-b', 5, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
  })

  it('accepte des limites différentes pour la même clé selon la category (catégories séparées)', () => {
    // Convention : la category fait partie de la clé. Vérifie que des
    // clés différentes (= categories différentes) ont des compteurs séparés.
    checkLimit('user-a:read', 300, 60_000)
    checkLimit('user-a:write', 60, 60_000)
    expect(checkLimit('user-a:read', 300, 60_000).remaining).toBe(298)
    expect(checkLimit('user-a:write', 60, 60_000).remaining).toBe(58)
  })

  it('resetAt reflète bien now + windowMs sur la première requête', () => {
    const before = Date.now()
    const r = checkLimit('user-a', 5, 60_000)
    expect(r.resetAt).toBe(before + 60_000)
  })

  it('resetAt reste stable pendant la window (pas de glissement)', () => {
    const r1 = checkLimit('user-a', 5, 60_000)
    vi.advanceTimersByTime(10_000)
    const r2 = checkLimit('user-a', 5, 60_000)
    expect(r2.resetAt).toBe(r1.resetAt) // fixed window, pas sliding
  })

  it('limit=0 refuse toutes les requêtes', () => {
    const r = checkLimit('user-a', 0, 60_000)
    expect(r.allowed).toBe(false)
    expect(r.retryAfterSec).toBeGreaterThan(0)
  })
})
