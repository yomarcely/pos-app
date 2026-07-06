import { describe, it, expect } from 'vitest'
import { parsePaginationQuery, paginationMeta, createApiError } from '~/server/utils/apiResponse'
import { createMockEvent } from '../setup'

// Le stub global de createError (tests/setup.ts) retourne { __isError: true, ...input } :
// les assertions ci-dessous portent sur l'objet passé à createError.
describe('createApiError', () => {
  it('porte statusCode, message et data.{code, retryable}', () => {
    const err = createApiError(400, 'CART_EMPTY', 'Le panier est vide') as unknown as Record<string, unknown>
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('Le panier est vide')
    expect(err.data).toEqual({ code: 'CART_EMPTY', retryable: false })
  })

  it('retryable=false par défaut pour les 4xx', () => {
    for (const status of [400, 403, 404, 409]) {
      const err = createApiError(status, 'X', 'msg') as unknown as { data: { retryable: boolean } }
      expect(err.data.retryable).toBe(false)
    }
  })

  it('retryable=true par défaut pour les 5xx', () => {
    for (const status of [500, 502, 503]) {
      const err = createApiError(status, 'INTERNAL', 'msg') as unknown as { data: { retryable: boolean } }
      expect(err.data.retryable).toBe(true)
    }
  })

  it('retryable=true par défaut pour 429 (rate limit)', () => {
    const err = createApiError(429, 'RATE_LIMITED', 'msg') as unknown as { data: { retryable: boolean } }
    expect(err.data.retryable).toBe(true)
  })

  it('opts.retryable surcharge le défaut dans les deux sens', () => {
    const retryable409 = createApiError(409, 'VOUCHER_CONFLICT', 'msg', { retryable: true }) as unknown as { data: { retryable: boolean } }
    expect(retryable409.data.retryable).toBe(true)

    const final500 = createApiError(500, 'INTERNAL', 'msg', { retryable: false }) as unknown as { data: { retryable: boolean } }
    expect(final500.data.retryable).toBe(false)
  })

  it('fusionne opts.data dans data sans perdre code/retryable', () => {
    const err = createApiError(403, 'PREVIOUS_DAY_NOT_CLOSED', 'msg', {
      data: { reason: 'previous_day_not_closed', day: '2026-07-05' },
    }) as unknown as { data: Record<string, unknown> }
    expect(err.data).toEqual({
      reason: 'previous_day_not_closed',
      day: '2026-07-05',
      code: 'PREVIOUS_DAY_NOT_CLOSED',
      retryable: false,
    })
  })

  it('code/retryable priment sur une collision dans opts.data', () => {
    const err = createApiError(400, 'VALIDATION_ERROR', 'msg', {
      data: { code: 'AUTRE', retryable: true },
    }) as unknown as { data: { code: string; retryable: boolean } }
    expect(err.data.code).toBe('VALIDATION_ERROR')
    expect(err.data.retryable).toBe(false)
  })

  it('transmet statusMessage quand fourni, ne le pose pas sinon', () => {
    const withSM = createApiError(400, 'VALIDATION_ERROR', 'msg', { statusMessage: 'Champ requis' }) as unknown as Record<string, unknown>
    expect(withSM.statusMessage).toBe('Champ requis')

    const withoutSM = createApiError(400, 'VALIDATION_ERROR', 'msg') as unknown as Record<string, unknown>
    expect('statusMessage' in withoutSM).toBe(false)
  })
})

describe('parsePaginationQuery', () => {
  it('retourne les défauts quand page et limit sont absents', () => {
    const event = createMockEvent({ query: {} })
    expect(parsePaginationQuery(event)).toEqual({ page: 1, limit: 50, offset: 0 })
  })

  it('parse page et limit valides', () => {
    const event = createMockEvent({ query: { page: '3', limit: '20' } })
    expect(parsePaginationQuery(event)).toEqual({ page: 3, limit: 20, offset: 40 })
  })

  it('clamp limit au maximum (200 par défaut)', () => {
    const event = createMockEvent({ query: { page: '1', limit: '5000' } })
    expect(parsePaginationQuery(event).limit).toBe(200)
  })

  it('respecte un maxLimit personnalisé', () => {
    const event = createMockEvent({ query: { page: '1', limit: '500' } })
    expect(parsePaginationQuery(event, { maxLimit: 100 }).limit).toBe(100)
  })

  it('respecte un defaultLimit personnalisé', () => {
    const event = createMockEvent({ query: {} })
    expect(parsePaginationQuery(event, { defaultLimit: 25 }).limit).toBe(25)
  })

  it('refuse page < 1 et fallback sur 1', () => {
    const event = createMockEvent({ query: { page: '0', limit: '10' } })
    expect(parsePaginationQuery(event).page).toBe(1)
  })

  it('refuse page négative et fallback sur 1', () => {
    const event = createMockEvent({ query: { page: '-5', limit: '10' } })
    expect(parsePaginationQuery(event).page).toBe(1)
  })

  it('refuse limit ≤ 0 et fallback sur le défaut', () => {
    const event = createMockEvent({ query: { page: '1', limit: '0' } })
    expect(parsePaginationQuery(event).limit).toBe(50)
  })

  it('ignore les valeurs non numériques', () => {
    const event = createMockEvent({ query: { page: 'abc', limit: 'xyz' } })
    expect(parsePaginationQuery(event)).toEqual({ page: 1, limit: 50, offset: 0 })
  })

  it('tronque les flottants en entiers', () => {
    const event = createMockEvent({ query: { page: '2.7', limit: '15.9' } })
    expect(parsePaginationQuery(event)).toEqual({ page: 2, limit: 15, offset: 15 })
  })

  it('calcule un offset cohérent avec page et limit', () => {
    const event = createMockEvent({ query: { page: '5', limit: '20' } })
    expect(parsePaginationQuery(event).offset).toBe(80)
  })
})

describe('paginationMeta', () => {
  it('calcule pages, hasNext, hasPrev pour une page intermédiaire', () => {
    const meta = paginationMeta({ page: 2, limit: 10, total: 35 })
    expect(meta).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      pages: 4,
      hasNext: true,
      hasPrev: true,
    })
  })

  it('détecte la première page (hasPrev=false)', () => {
    const meta = paginationMeta({ page: 1, limit: 10, total: 35 })
    expect(meta.hasPrev).toBe(false)
    expect(meta.hasNext).toBe(true)
  })

  it('détecte la dernière page (hasNext=false)', () => {
    const meta = paginationMeta({ page: 4, limit: 10, total: 35 })
    expect(meta.hasNext).toBe(false)
    expect(meta.hasPrev).toBe(true)
  })

  it('total=0 → pages=1, hasNext=false, hasPrev=false', () => {
    const meta = paginationMeta({ page: 1, limit: 10, total: 0 })
    expect(meta).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    })
  })

  it('arrondit le nombre de pages au supérieur (35/10 = 4)', () => {
    expect(paginationMeta({ page: 1, limit: 10, total: 35 }).pages).toBe(4)
  })

  it('total exactement multiple de limit (40/10 = 4)', () => {
    expect(paginationMeta({ page: 1, limit: 10, total: 40 }).pages).toBe(4)
  })

  it('clamp un total négatif à 0', () => {
    const meta = paginationMeta({ page: 1, limit: 10, total: -5 })
    expect(meta.total).toBe(0)
    expect(meta.pages).toBe(1)
  })
})
