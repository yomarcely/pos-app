import type { H3Event } from 'h3'

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
