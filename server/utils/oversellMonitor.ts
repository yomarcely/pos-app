/**
 * ==========================================
 * Détecteur de survente en rafale (A5)
 * ==========================================
 *
 * Compteur « fixed window » in-memory, même pattern que
 * `server/utils/rateLimiter.ts` : chaque établissement a un compteur de
 * mouvements de stock en survente (`oversell = true`) qui se réinitialise
 * toutes les `WINDOW_MS`.
 *
 * Pourquoi : une survente isolée est légitime (le commerçant assume la vente
 * stock à zéro, cf. P1.3). Plus de `THRESHOLD` sur `WINDOW_MS` pour un même
 * établissement, c'est autre chose : le stock système ne représente plus le
 * réel (inventaire jamais fait, réception oubliée, import raté). C'est un
 * signal à remonter au commerçant, pas une erreur à lui renvoyer en caisse.
 *
 * **Limite connue** (identique au rate limiter) : single-instance. Avec N
 * instances Node, chacune compte de son côté — le seuil effectif est donc au
 * pire N × `THRESHOLD`. Acceptable ici : c'est un détecteur d'anomalie, pas une
 * garantie de sécurité, et un faux négatif se rattrape à la rafale suivante.
 *
 * Ce module ne fait QUE compter. L'émission de l'alerte Sentry appartient à
 * `server/utils/nf525Alerting.ts` : ainsi le compteur reste testable sans mock
 * Sentry, et l'appelant ne peut pas être bloqué par l'observabilité.
 */

export const WINDOW_MS = 10 * 60_000 // 10 minutes
export const THRESHOLD = 5 // > 5 mouvements sur la fenêtre → rafale

interface Bucket {
  count: number
  resetAt: number // ms epoch
}

export interface OversellBurstResult {
  /** Total de mouvements oversell comptés sur la fenêtre courante. */
  count: number
  /** `true` uniquement sur l'appel qui fait FRANCHIR le seuil (pas à chaque appel au-delà). */
  burst: boolean
  windowMs: number
  threshold: number
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
 * Enregistre `movements` mouvements de survente pour un établissement et
 * indique si le seuil de rafale vient d'être franchi.
 *
 * Le drapeau `burst` n'est vrai que sur la transition (count passe de ≤ seuil à
 * > seuil) : au-delà, le throttle de `nf525Alerting` prendrait le relais, mais
 * autant ne pas l'y forcer. Une fenêtre expirée repart de zéro.
 *
 * @param tenantId - Tenant propriétaire (isolation stricte des compteurs)
 * @param establishmentId - Établissement concerné
 * @param movements - Nombre de lignes en survente sur cette vente (défaut 1)
 */
export function recordOversellMovements(
  tenantId: string,
  establishmentId: number,
  movements = 1,
): OversellBurstResult {
  const now = Date.now()
  maybeCleanup(now)

  const base: Omit<OversellBurstResult, 'count' | 'burst'> = {
    windowMs: WINDOW_MS,
    threshold: THRESHOLD,
  }

  // Garde-fou défensif : un appel sans mouvement ne doit rien compter ni alerter.
  if (movements <= 0) {
    const existing = buckets.get(bucketKey(tenantId, establishmentId))
    const count = existing && existing.resetAt > now ? existing.count : 0
    return { ...base, count, burst: false }
  }

  const key = bucketKey(tenantId, establishmentId)
  const bucket = buckets.get(key)

  // Pas de bucket ou fenêtre expirée → reset
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: movements, resetAt: now + WINDOW_MS })
    return { ...base, count: movements, burst: movements > THRESHOLD }
  }

  const before = bucket.count
  bucket.count += movements
  return {
    ...base,
    count: bucket.count,
    burst: before <= THRESHOLD && bucket.count > THRESHOLD,
  }
}

/** Clé de compteur — le tenantId préfixe tout : deux tenants ne se mélangent jamais. */
function bucketKey(tenantId: string, establishmentId: number): string {
  return `${tenantId}:${establishmentId}`
}

/**
 * Réinitialise tout le store. Réservé aux tests.
 */
export function _resetOversellMonitorForTests(): void {
  buckets.clear()
  callCount = 0
}
