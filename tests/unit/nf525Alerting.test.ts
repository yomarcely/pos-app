import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const captureMessage = vi.fn()

vi.mock('@sentry/nuxt', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}))

import {
  reportChainIntegrityFailure,
  reportClosureRefused,
  reportOversellBurst,
  _resetAlertingForTests,
} from '~/server/utils/nf525Alerting'

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

describe('A5 — alerting invariants NF525', () => {
  beforeEach(() => {
    _resetAlertingForTests()
    captureMessage.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T06:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('reportChainIntegrityFailure', () => {
    const payload = {
      tenantId: 'tenant-1',
      source: 'cron' as const,
      registerId: 3,
      businessDay: '2026-09-09',
      ticketCount: 42,
      brokenTicketNumbers: ['20260909-E01-R03-000012'],
    }

    it('émet un event de niveau error, tenantId en clair pour grouper', () => {
      expect(reportChainIntegrityFailure(payload)).toBe(true)

      const [message, ctx] = getCall(0)
      expect(message).toContain('chaîne de tickets cassée')
      expect(ctx.level).toBe('error')
      expect(ctx.tags.scope).toBe('nf525-chain')
      expect(ctx.tags.tenantId).toBe('tenant-1')
      expect(ctx.tags.source).toBe('cron')
      expect(ctx.extra.brokenLinksCount).toBe(1)
      expect(ctx.extra.businessDay).toBe('2026-09-09')
    })

    it('borne la liste des tickets cassés à 50 et signale la troncature', () => {
      const many = Array.from({ length: 130 }, (_, i) => `T-${i}`)
      reportChainIntegrityFailure({ ...payload, brokenTicketNumbers: many })

      const [, ctx] = getCall(0)
      expect((ctx.extra.brokenTicketNumbers as string[]).length).toBe(50)
      expect(ctx.extra.brokenTicketNumbersTruncated).toBe(80)
      expect(ctx.extra.brokenLinksCount).toBe(130)
    })

    it('throttle la même caisse pendant 1 minute puis ré-émet', () => {
      expect(reportChainIntegrityFailure(payload)).toBe(true)
      expect(reportChainIntegrityFailure(payload)).toBe(false)
      expect(captureMessage).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(60_001)
      expect(reportChainIntegrityFailure(payload)).toBe(true)
      expect(captureMessage).toHaveBeenCalledTimes(2)
    })

    it('ne throttle pas deux caisses différentes', () => {
      expect(reportChainIntegrityFailure(payload)).toBe(true)
      expect(reportChainIntegrityFailure({ ...payload, registerId: 4 })).toBe(true)
      expect(captureMessage).toHaveBeenCalledTimes(2)
    })
  })

  describe('reportClosureRefused', () => {
    const base = {
      tenantId: 'tenant-1',
      registerId: 2,
      businessDay: '2026-09-09',
      userId: 'user-abc',
      ipAddress: '203.0.113.4',
    }

    it('classe totals_mismatch en error (incohérence comptable)', () => {
      reportClosureRefused({ ...base, reason: 'totals_mismatch', details: { diffCents: 37 } })

      const [message, ctx] = getCall(0)
      expect(message).toContain('totals_mismatch')
      expect(ctx.level).toBe('error')
      expect(ctx.tags.reason).toBe('totals_mismatch')
      expect(ctx.extra.diffCents).toBe(37)
    })

    it('classe pending_sales en warning (erreur d’exploitation)', () => {
      reportClosureRefused({ ...base, reason: 'pending_sales', details: { pendingCount: 2 } })

      const [, ctx] = getCall(0)
      expect(ctx.level).toBe('warning')
      expect(ctx.extra.pendingCount).toBe(2)
    })

    it('RGPD : userId et IP sont hashés, jamais envoyés en clair', () => {
      reportClosureRefused({ ...base, reason: 'pending_sales' })

      const [, ctx] = getCall(0)
      const serialized = JSON.stringify(ctx)
      expect(serialized).not.toContain('user-abc')
      expect(serialized).not.toContain('203.0.113.4')
      expect(ctx.extra.userHash).toMatch(/^[0-9a-f]{12}$/)
      expect(ctx.extra.ipHash).toMatch(/^[0-9a-f]{12}$/)
      // Le tenantId, lui, reste en clair : il sert à grouper côté Sentry.
      expect(ctx.tags.tenantId).toBe('tenant-1')
    })

    it('throttle par (tenant, caisse, motif) — deux motifs restent distincts', () => {
      expect(reportClosureRefused({ ...base, reason: 'pending_sales' })).toBe(true)
      expect(reportClosureRefused({ ...base, reason: 'pending_sales' })).toBe(false)
      expect(reportClosureRefused({ ...base, reason: 'totals_mismatch' })).toBe(true)
    })
  })

  describe('reportOversellBurst', () => {
    it('émet un warning avec le compte et la fenêtre', () => {
      expect(reportOversellBurst({
        tenantId: 'tenant-1',
        establishmentId: 7,
        count: 9,
        windowMs: 600_000,
        threshold: 5,
      })).toBe(true)

      const [message, ctx] = getCall(0)
      expect(message).toContain('Survente en rafale')
      expect(ctx.level).toBe('warning')
      expect(ctx.tags.scope).toBe('stock-oversell')
      expect(ctx.extra.establishmentId).toBe(7)
      expect(ctx.extra.oversellCount).toBe(9)
    })
  })

  describe('contrat de non-blocage', () => {
    // Invariant : « l'observabilité ne bloque jamais », même contrat que l'audit.
    // Une panne Sentry ne doit pas remonter dans le flux de vente ou de clôture.
    it('n’escalade jamais un échec de capture Sentry', () => {
      captureMessage.mockImplementation(() => {
        throw new Error('Sentry transport down')
      })

      expect(() => reportChainIntegrityFailure({
        tenantId: 'tenant-1',
        source: 'api',
        ticketCount: 1,
        brokenTicketNumbers: ['T-1'],
      })).not.toThrow()

      expect(() => reportClosureRefused({
        tenantId: 'tenant-1',
        reason: 'totals_mismatch',
        registerId: 1,
        businessDay: '2026-09-09',
      })).not.toThrow()

      expect(() => reportOversellBurst({
        tenantId: 'tenant-1',
        establishmentId: 1,
        count: 6,
        windowMs: 600_000,
        threshold: 5,
      })).not.toThrow()
    })

    it('renvoie false quand la capture a échoué (pas de faux positif de succès)', () => {
      captureMessage.mockImplementation(() => {
        throw new Error('Sentry transport down')
      })

      expect(reportOversellBurst({
        tenantId: 'tenant-1',
        establishmentId: 1,
        count: 6,
        windowMs: 600_000,
        threshold: 5,
      })).toBe(false)
    })
  })
})
