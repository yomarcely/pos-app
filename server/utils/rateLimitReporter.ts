import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nuxt'

/**
 * ==========================================
 * Rate limit reporter (C2)
 * ==========================================
 *
 * Remonte les dépassements 429 à Sentry avec un anti-spam par clé
 * (1 event max par clé toutes les `THROTTLE_MS`) pour éviter d'épuiser
 * le quota lors d'un pic.
 *
 * RGPD : userId et IP sont hashés (SHA-256 tronqué) avant envoi.
 * Le tenantId reste en clair car il est utile pour grouper côté Sentry
 * et n'est pas une donnée personnelle au sens RGPD.
 */

const THROTTLE_MS = 60_000
const MAX_TRACKED_KEYS = 5_000

const lastSentAt = new Map<string, number>()

function hashShort(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12)
}

function maybeCleanup(now: number): void {
  if (lastSentAt.size <= MAX_TRACKED_KEYS) return
  for (const [k, t] of lastSentAt.entries()) {
    if (now - t > THROTTLE_MS * 2) lastSentAt.delete(k)
  }
}

export interface RateLimitReportPayload {
  key: string
  category: string
  isPublic: boolean
  path: string
  method: string
  limit: number
  windowMs: number
  retryAfterSec: number
  tenantId?: string | null
  userId?: string | null
  ip?: string | null
}

export function reportRateLimitExceeded(payload: RateLimitReportPayload): boolean {
  const now = Date.now()
  const last = lastSentAt.get(payload.key) ?? 0
  if (now - last < THROTTLE_MS) return false

  lastSentAt.set(payload.key, now)
  maybeCleanup(now)

  Sentry.captureMessage(`Rate limit exceeded: ${payload.category}`, {
    level: 'warning',
    tags: {
      scope: 'rate-limit',
      category: payload.category,
      isPublic: String(payload.isPublic),
      ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
    },
    extra: {
      path: payload.path,
      method: payload.method,
      limit: payload.limit,
      windowMs: payload.windowMs,
      retryAfterSec: payload.retryAfterSec,
      keyHash: hashShort(payload.key),
      ...(payload.userId ? { userHash: hashShort(payload.userId) } : {}),
      ...(payload.ip ? { ipHash: hashShort(payload.ip) } : {}),
    },
  })

  return true
}

export function _resetReporterForTests(): void {
  lastSentAt.clear()
}
