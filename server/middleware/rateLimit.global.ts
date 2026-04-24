import { getRequestIP } from 'h3'
import { checkLimit } from '~/server/utils/rateLimiter'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * Rate limiting middleware (Q10)
 * ==========================================
 *
 * S'exécute APRÈS auth.global.ts (ordre alphabétique : `auth` < `rateLimit`)
 * pour avoir accès à `event.context.auth` quand l'utilisateur est authentifié.
 *
 * Stratégie :
 * - Authentifié : clé = `tenantId:userId:category` (granularité fine)
 * - Non-authentifié (PUBLIC_ENDPOINTS) : clé = `ip:path` (par IP)
 *
 * Limites par catégorie :
 * - sales-create : 30 req/min  — pic possible en rush, mais reste raisonnable
 * - mutation     : 60 req/min  — POST/PUT/PATCH/DELETE génériques
 * - read         : 300 req/min — GET
 * - public       : 5 req/min   — endpoints non-auth (signup, etc.) — par IP
 *
 * Réponse 429 : status + Retry-After + headers X-RateLimit-*.
 * Headers info posés sur toutes les réponses (allowed ou non).
 */

const PUBLIC_ENDPOINTS = ['/api/login', '/api/auth']

interface CategoryConfig {
  limit: number
  windowMs: number
  category: string
}

const SALES_CREATE: CategoryConfig = { limit: 30, windowMs: 60_000, category: 'sales-create' }
const MUTATION: CategoryConfig = { limit: 60, windowMs: 60_000, category: 'mutation' }
const READ: CategoryConfig = { limit: 300, windowMs: 60_000, category: 'read' }
const PUBLIC: CategoryConfig = { limit: 5, windowMs: 60_000, category: 'public' }

function classify(path: string, method: string): CategoryConfig {
  if (path.startsWith('/api/sales/create')) return SALES_CREATE
  if (method === 'GET' || method === 'HEAD') return READ
  return MUTATION
}

function buildKey(event: { context?: { auth?: { tenantId?: string; user?: { id?: string } } } }, ip: string | null, category: string): string {
  const auth = event.context?.auth
  if (auth?.tenantId && auth.user?.id) {
    return `auth:${auth.tenantId}:${auth.user.id}:${category}`
  }
  return `ip:${ip || 'unknown'}:${category}`
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api')) return
  if (event.method === 'OPTIONS') return

  const isPublic = PUBLIC_ENDPOINTS.some(p => path.startsWith(p))
  const ip = getRequestIP(event) || null

  // Endpoints publics : rate limit par IP avec seuil bas (anti-bruteforce)
  // Authentifiés : par tenantId+userId+category
  const config = isPublic ? PUBLIC : classify(path, event.method || 'GET')
  const key = isPublic
    ? `ip:${ip || 'unknown'}:${path}` // path-spécifique pour les publics
    : buildKey(event, ip, config.category)

  const result = checkLimit(key, config.limit, config.windowMs)

  // Headers info sur toutes les réponses
  setResponseHeader(event, 'X-RateLimit-Limit', String(result.limit))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(result.remaining))
  setResponseHeader(event, 'X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)))

  if (!result.allowed) {
    setResponseHeader(event, 'Retry-After', String(result.retryAfterSec))
    logger.warn({
      path,
      method: event.method,
      key,
      limit: config.limit,
      windowMs: config.windowMs,
    }, 'Rate limit exceeded')

    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: `Trop de requêtes. Réessayez dans ${result.retryAfterSec}s.`,
    })
  }
})
