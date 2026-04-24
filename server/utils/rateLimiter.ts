/**
 * ==========================================
 * Rate limiter in-memory (Q10)
 * ==========================================
 *
 * Implémentation "fixed window" : chaque clé a un compteur qui se
 * réinitialise toutes les `windowMs` ms.
 *
 * **Limite connue** : single-instance uniquement. Si plusieurs instances
 * Node tournent (cluster ou pods), chacune compte indépendamment — la
 * limite effective globale est donc N × `limit`. Pour un vrai rate limit
 * distribué, migrer vers Redis (changement transparent côté appelants :
 * la signature de `checkLimit` reste compatible).
 *
 * Cleanup : les clés expirées sont retirées paresseusement (toutes les
 * `CLEANUP_INTERVAL_CALLS` appels) pour éviter une fuite mémoire sans
 * dépendre d'un setInterval (problématique en test).
 */

interface Bucket {
  count: number
  resetAt: number // ms epoch
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // ms epoch
  retryAfterSec: number // seconds, 0 si allowed
  limit: number
}

// Store global au module — partagé entre toutes les requêtes du même process
const buckets = new Map<string, Bucket>()

const CLEANUP_INTERVAL_CALLS = 1000
let callCount = 0

function maybeCleanup(now: number): void {
  callCount++
  if (callCount % CLEANUP_INTERVAL_CALLS !== 0) return
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Vérifie et incrémente le compteur pour `key`.
 * Si la window est expirée (ou première requête), réinitialise le compteur.
 */
export function checkLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  maybeCleanup(now)

  // Garde-fou défensif : limit ≤ 0 → tout refuser
  if (limit <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + windowMs,
      retryAfterSec: Math.ceil(windowMs / 1000),
      limit,
    }
  }

  const bucket = buckets.get(key)

  // Pas de bucket ou window expirée → reset
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
      retryAfterSec: 0,
      limit,
    }
  }

  // Window active
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
      limit,
    }
  }

  bucket.count++
  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt,
    retryAfterSec: 0,
    limit,
  }
}

/**
 * Réinitialise tout le store. Réservé aux tests.
 */
export function _resetForTests(): void {
  buckets.clear()
  callCount = 0
}
