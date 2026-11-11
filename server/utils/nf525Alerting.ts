import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nuxt'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * Alerting invariants NF525 (A5)
 * ==========================================
 *
 * Remonte à Sentry les invariants métier qui ne lèvent PAS d'exception 5xx :
 * chaîne de tickets cassée, refus de clôture, survente en rafale. Ce sont des
 * signaux qu'une caisse va mal — depuis l'abandon de l'offline (2026-09-10) le
 * serveur *est* la caisse, donc c'est le seul canal d'apprentissage d'une panne.
 *
 * Même contrat que `server/utils/rateLimitReporter.ts`, dont ce module reprend
 * volontairement le pattern :
 * - anti-spam par clé (1 event max par clé toutes les `THROTTLE_MS`) pour ne pas
 *   épuiser le quota Sentry lors d'un incident en boucle ;
 * - RGPD : userId et IP hashés (SHA-256 tronqué) avant envoi. Le `tenantId` reste
 *   en clair : il sert à grouper côté Sentry et n'est pas une donnée personnelle.
 *
 * ⚠️ Contrat de non-blocage (identique à l'audit trail, cf. `audit.ts`) : ces
 * fonctions ne lèvent JAMAIS. Une panne de Sentry ne doit pas faire échouer une
 * vente ni une clôture — d'où le `safeCapture` qui avale tout.
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

/** `true` si l'event a été émis, `false` s'il a été étouffé par le throttle. */
function throttled(key: string): boolean {
  const now = Date.now()
  const last = lastSentAt.get(key) ?? 0
  if (now - last < THROTTLE_MS) return true

  lastSentAt.set(key, now)
  maybeCleanup(now)
  return false
}

/**
 * Exécute un reporter sans jamais propager d'erreur à l'appelant.
 *
 * La garde englobe TOUT le corps (construction du payload, hachage, throttle,
 * envoi), pas seulement l'appel Sentry : ces reporters sont invoqués depuis le
 * flux de vente et depuis le chemin de refus de clôture, où une exception
 * inattendue transformerait un 409 métier en 500. L'observabilité ne doit
 * jamais devenir une source de panne.
 */
function guarded(report: () => boolean): boolean {
  try {
    return report()
  } catch (error) {
    logger.error({ err: error }, '[alerting] Échec de la remontée Sentry (ignoré)')
    return false
  }
}

// ==========================================
// 1. Chaîne NF525 cassée
// ==========================================

export interface ChainIntegrityPayload {
  tenantId: string
  /** `api` = /api/sales/verify-chain (utilisateur) ; `cron` = contrôle planifié. */
  source: 'api' | 'cron'
  ticketCount: number
  brokenTicketNumbers: string[]
  registerId?: number | null
  businessDay?: string
}

/**
 * Chaîne de tickets invalide → `error`. C'est l'invariant le plus grave du
 * produit : hors panne de vérification, il signale une altération de données.
 */
export function reportChainIntegrityFailure(payload: ChainIntegrityPayload): boolean {
  return guarded(() => {
    const key = `chain:${payload.tenantId}:${payload.registerId ?? 'all'}:${payload.source}`
    if (throttled(key)) return false

    Sentry.captureMessage('NF525 : chaîne de tickets cassée', {
      level: 'error',
      tags: {
        scope: 'nf525-chain',
        source: payload.source,
        tenantId: payload.tenantId,
      },
      extra: {
        ticketCount: payload.ticketCount,
        brokenLinksCount: payload.brokenTicketNumbers.length,
        // Borné : une chaîne entièrement cassée produirait des milliers de numéros.
        brokenTicketNumbers: payload.brokenTicketNumbers.slice(0, 50),
        ...(payload.brokenTicketNumbers.length > 50
          ? { brokenTicketNumbersTruncated: payload.brokenTicketNumbers.length - 50 }
          : {}),
        ...(payload.registerId ? { registerId: payload.registerId } : {}),
        ...(payload.businessDay ? { businessDay: payload.businessDay } : {}),
      },
    })
    return true
  })
}

export interface ChainVerificationErrorPayload {
  tenantId: string
  registerId: number
  businessDay: string
  /** Nom de l'erreur uniquement (`Error`, `TypeError`…) — jamais son message. */
  errorName: string
}

/**
 * La vérification d'une caisse a PLANTÉ (base indisponible, ticket illisible…)
 * → `error`. Distinct de « chaîne cassée » : ici on ne sait pas si la chaîne est
 * intacte, et c'est précisément ce qu'il faut signaler — une caisse non vérifiée
 * ne doit jamais passer pour une caisse saine. Un ticket rendu illisible par une
 * altération en base tombe dans ce cas.
 *
 * Seul le nom de l'erreur part : son message peut contenir des valeurs issues de
 * la base (paramètres SQL, contenu d'un ticket). Le détail reste dans les logs.
 */
export function reportChainVerificationError(payload: ChainVerificationErrorPayload): boolean {
  return guarded(() => {
    const key = `chain-error:${payload.tenantId}:${payload.registerId}`
    if (throttled(key)) return false

    Sentry.captureMessage('NF525 : vérification de chaîne impossible', {
      level: 'error',
      tags: {
        scope: 'nf525-chain',
        source: 'cron',
        tenantId: payload.tenantId,
      },
      extra: {
        registerId: payload.registerId,
        businessDay: payload.businessDay,
        errorName: payload.errorName,
      },
    })
    return true
  })
}

// ==========================================
// 2. Refus de clôture
// ==========================================

export type ClosureRefusalReason = 'pending_sales' | 'totals_mismatch'

export interface ClosureRefusedPayload {
  tenantId: string
  reason: ClosureRefusalReason
  registerId: number
  businessDay: string
  /** Détails spécifiques au motif (compte de tickets en attente, écart en centimes…). */
  details?: Record<string, string | number | boolean | null>
  userId?: string | number | null
  ipAddress?: string | null
}

/**
 * Refus de clôture (409). Deux niveaux, volontairement différents :
 * - `totals_mismatch` → **error** : HT + TVA ≠ TTC est une incohérence comptable,
 *   la donnée est déjà fausse en base et aucune manipulation du commerçant ne la
 *   corrige — il faut regarder les ventes du jour.
 * - `pending_sales` → **warning** : le plus souvent une simple erreur
 *   d'exploitation (ticket en attente oublié), résolue par le commerçant seul.
 *
 * Ces 409 ne sont PAS remontés par le handler d'erreurs global de Sentry, qui
 * ignore les H3Error 3xx/4xx — c'est précisément pourquoi on capture ici.
 */
export function reportClosureRefused(payload: ClosureRefusedPayload): boolean {
  return guarded(() => {
    const key = `closure:${payload.tenantId}:${payload.registerId}:${payload.reason}`
    if (throttled(key)) return false

    const level = payload.reason === 'totals_mismatch' ? 'error' : 'warning'

    Sentry.captureMessage(`Clôture refusée : ${payload.reason}`, {
      level,
      tags: {
        scope: 'nf525-closure',
        reason: payload.reason,
        tenantId: payload.tenantId,
      },
      extra: {
        registerId: payload.registerId,
        businessDay: payload.businessDay,
        ...(payload.details ?? {}),
        ...(payload.userId ? { userHash: hashShort(String(payload.userId)) } : {}),
        ...(payload.ipAddress ? { ipHash: hashShort(payload.ipAddress) } : {}),
      },
    })
    return true
  })
}

// ==========================================
// 3. Survente en rafale
// ==========================================

export interface OversellBurstPayload {
  tenantId: string
  establishmentId: number
  /** Mouvements oversell comptés sur la fenêtre courante. */
  count: number
  windowMs: number
  threshold: number
}

/**
 * Survente en rafale → `warning`. Une survente isolée est légitime (flag
 * `oversell` assumé par le commerçant, cf. P1.3) ; en rafale, c'est le signe que
 * le stock système est décorrélé du réel sur cet établissement.
 */
export function reportOversellBurst(payload: OversellBurstPayload): boolean {
  return guarded(() => {
    const key = `oversell:${payload.tenantId}:${payload.establishmentId}`
    if (throttled(key)) return false

    Sentry.captureMessage('Survente en rafale : stock système décorrélé du réel', {
      level: 'warning',
      tags: {
        scope: 'stock-oversell',
        tenantId: payload.tenantId,
      },
      extra: {
        establishmentId: payload.establishmentId,
        oversellCount: payload.count,
        windowMs: payload.windowMs,
        threshold: payload.threshold,
      },
    })
    return true
  })
}

// ==========================================
// 4. Erreurs système : volontairement PAS de capture ici
// ==========================================
//
// `logSystemError` (server/utils/audit.ts) n'émet AUCUN event Sentry, et c'est
// délibéré. Vérifié dans @sentry/nuxt 10.50 (`runtime/hooks/captureErrorHook.js`) :
// le handler d'erreurs global capture tout ce qui remonte d'un handler Nitro,
// avec un seul `return` anticipé — les `H3Error` de statut 300–499.
//
// Or les deux appelants de `logSystemError` (sales/create.post.ts,
// sales/close-day.post.ts) relancent systématiquement l'erreur. Donc :
// - erreur non-H3 ou 5xx → déjà capturée par le handler global. Capturer ici
//   doublerait le volume et épuiserait le quota pour rien.
// - 4xx métier qui méritent une alerte → ce sont les deux refus de clôture 409,
//   capturés à leur point de levée par `reportClosureRefused`, avec le bon
//   niveau et un fingerprint distinct (bien plus exploitable qu'un message
//   générique « erreur système »).
// - autres 4xx (validation, 401/403/404) → bruit client, pas un incident serveur.
//
// Il ne reste donc aucun trou à combler. Si un jour un appelant de
// `logSystemError` avale l'erreur au lieu de la relancer, ce raisonnement tombe
// et il faudra capturer explicitement à cet endroit-là.

export function _resetAlertingForTests(): void {
  lastSentAt.clear()
}
