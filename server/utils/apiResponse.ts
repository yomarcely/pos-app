/**
 * ==========================================================================
 * Convention d'erreur API — createApiError
 * ==========================================================================
 *
 * Toute erreur émise via `createApiError` porte dans `data` :
 *   - `code`      : slug machine STABLE en SCREAMING_SNAKE_CASE. Contrat client
 *                   (offline, support) — ne jamais renommer un code publié.
 *   - `retryable` : le client (futur mode offline) peut-il rejouer la requête
 *                   telle quelle ? Défaut : false pour les 4xx (erreur définitive,
 *                   rejouer ne changera rien), true pour les 5xx et 429 (état
 *                   transitoire côté serveur). Surchargeable via `opts.retryable`.
 *
 * Les champs métier additionnels (ex. `reason`, `day`, `errors`) restent dans
 * `data` via `opts.data` — `code`/`retryable` priment en cas de collision.
 * Le `message` reste humain/localisé : le client route sur `code`, jamais sur
 * le texte.
 *
 * Codes existants (adoption progressive — sales/create, sales/close-day,
 * movements/create, validation Zod) :
 *   VALIDATION_ERROR                  400 — body/query rejeté par Zod (data.errors[])
 *   CART_EMPTY                        400 — panier vide
 *   SELLER_MISSING                    400 — vendeur absent
 *   PAYMENT_MISSING                   400 — aucun mode de paiement
 *   ESTABLISHMENT_OR_REGISTER_MISSING 400 — establishmentId/registerId absents
 *   REGISTER_INACTIVE                 400 — caisse introuvable ou inactive
 *   REGISTER_ESTABLISHMENT_MISMATCH   400 — caisse d'un autre établissement
 *   ESTABLISHMENT_INACTIVE            400 — établissement introuvable ou inactif
 *   REGISTER_NOT_FOUND                404 — caisse inexistante (close-day)
 *   DAY_ALREADY_CLOSED                400/403 — journée déjà clôturée
 *   PREVIOUS_DAY_NOT_CLOSED           403 — journée antérieure non clôturée (data.day)
 *   TOTALS_MISMATCH                   400/409 — incohérence HT/TVA/TTC
 *   VOUCHER_CUSTOMER_REQUIRED         400 — bon d'achat sans client rattaché
 *   VOUCHER_INVALID                   400 — bon inexistant/expiré/mauvais client
 *   VOUCHER_CONFLICT                  409 — bon consommé par une vente concurrente
 *   PENDING_SALES                     409 — tickets en attente bloquent la clôture
 *   PRODUCT_NOT_FOUND                 404 — produit inexistant (movements)
 *   MOVEMENT_TYPE_MISSING             400 — type de mouvement absent
 *   MOVEMENT_ITEMS_EMPTY              400 — mouvement sans article
 *   INTERNAL                          500 — erreur interne générique
 * ==========================================================================
 */

// Type inline érasé par TS — pas d'import 'h3' (cf. server/utils/supabase.ts).
type H3Event = import('h3').H3Event

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ApiErrorPayload {
  code?: string
  message: string
  details?: unknown
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiErrorPayload
  meta?: {
    pagination?: PaginationMeta
    [key: string]: unknown
  }
}

export interface ApiErrorOptions {
  /** Surcharge du défaut (4xx → false, 5xx et 429 → true). */
  retryable?: boolean
  /** Détails métier fusionnés dans `data` (code/retryable priment en cas de collision). */
  data?: Record<string, unknown>
  /** statusMessage explicite (sinon comportement createError standard). */
  statusMessage?: string
}

/**
 * Construit une erreur H3 normalisée (cf. convention en tête de fichier).
 * `data` contient toujours `{ code, retryable }` en plus des détails éventuels.
 */
export function createApiError(
  statusCode: number,
  code: string,
  message: string,
  opts: ApiErrorOptions = {},
) {
  const retryable = opts.retryable ?? (statusCode >= 500 || statusCode === 429)
  return createError({
    statusCode,
    ...(opts.statusMessage !== undefined ? { statusMessage: opts.statusMessage } : {}),
    message,
    data: { ...opts.data, code, retryable },
  })
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Lit `page` et `limit` depuis la query string, les normalise et calcule l'offset.
 * - `page` : entier ≥ 1 (défaut 1)
 * - `limit` : entier dans [1, MAX_LIMIT] (défaut DEFAULT_LIMIT)
 * - Valeurs invalides ou absentes → fallback sur les défauts
 */
export function parsePaginationQuery(
  event: H3Event,
  options: { defaultLimit?: number, maxLimit?: number } = {},
): PaginationParams {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT
  const maxLimit = options.maxLimit ?? MAX_LIMIT

  const query = getQuery(event)
  const rawPage = Number(query.page)
  const rawLimit = Number(query.limit)

  const page = Number.isFinite(rawPage) && rawPage >= 1
    ? Math.floor(rawPage)
    : 1

  let limit = Number.isFinite(rawLimit) && rawLimit >= 1
    ? Math.floor(rawLimit)
    : defaultLimit
  if (limit > maxLimit) limit = maxLimit

  return { page, limit, offset: (page - 1) * limit }
}

/**
 * Construit le bloc meta.pagination à partir du total réel et des params utilisés.
 */
export function paginationMeta(params: { page: number, limit: number, total: number }): PaginationMeta {
  const total = Math.max(0, Math.floor(params.total))
  const pages = params.limit > 0 ? Math.max(1, Math.ceil(total / params.limit)) : 1
  return {
    page: params.page,
    limit: params.limit,
    total,
    pages,
    hasNext: params.page < pages && total > 0,
    hasPrev: params.page > 1,
  }
}
