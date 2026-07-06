import { describe, it, expect } from 'vitest'
import { extractFetchError, extractApiError } from '~/composables/useFetchError'

// Forme FetchError ($fetch/ofetch) : err.data = corps JSON H3
// { statusCode, statusMessage, message, data: { code, retryable, ... } }
const fetchError = (body: Record<string, unknown>, statusCode = 400) => ({
  statusCode,
  message: `${statusCode} (request failed)`,
  data: body,
})

describe('extractFetchError (API historique)', () => {
  it('retourne le fallback pour une erreur non-objet', () => {
    expect(extractFetchError('boom', 'fallback')).toBe('fallback')
    expect(extractFetchError(null)).toBe('Une erreur est survenue')
  })

  it('respecte la priorité data.message → data.statusMessage → statusMessage → message', () => {
    expect(extractFetchError({ data: { message: 'a', statusMessage: 'b' }, statusMessage: 'c', message: 'd' })).toBe('a')
    expect(extractFetchError({ data: { statusMessage: 'b' }, statusMessage: 'c', message: 'd' })).toBe('b')
    expect(extractFetchError({ statusMessage: 'c', message: 'd' })).toBe('c')
    expect(extractFetchError({ message: 'd' })).toBe('d')
  })

  it('retourne toujours une string même si l\'erreur porte code/retryable', () => {
    const err = fetchError({ message: 'Le panier est vide', data: { code: 'CART_EMPTY', retryable: false } })
    expect(extractFetchError(err)).toBe('Le panier est vide')
  })
})

describe('extractApiError', () => {
  it('expose code et retryable depuis une FetchError (payload dans data.data)', () => {
    const err = fetchError({
      statusCode: 403,
      message: 'La journée du 2026-07-05 est déjà clôturée pour cette caisse.',
      data: { code: 'DAY_ALREADY_CLOSED', retryable: false },
    }, 403)

    expect(extractApiError(err)).toEqual({
      message: 'La journée du 2026-07-05 est déjà clôturée pour cette caisse.',
      code: 'DAY_ALREADY_CLOSED',
      retryable: false,
      statusCode: 403,
    })
  })

  it('expose code et retryable depuis une erreur H3 brute (payload dans data)', () => {
    const err = {
      statusCode: 500,
      message: "Une erreur interne s'est produite",
      data: { code: 'INTERNAL', retryable: true },
    }
    const res = extractApiError(err)
    expect(res.code).toBe('INTERNAL')
    expect(res.retryable).toBe(true)
  })

  it('rétro-compatible : code/retryable undefined sur une erreur legacy sans data enrichi', () => {
    const err = fetchError({ statusCode: 400, message: 'Vieux format' })
    expect(extractApiError(err)).toEqual({
      message: 'Vieux format',
      code: undefined,
      retryable: undefined,
      statusCode: 400,
    })
  })

  it('ignore des code/retryable mal typés', () => {
    const err = fetchError({ message: 'msg', data: { code: 42, retryable: 'yes' } })
    const res = extractApiError(err)
    expect(res.code).toBeUndefined()
    expect(res.retryable).toBeUndefined()
  })

  it('retourne le fallback en message pour une erreur non-objet', () => {
    expect(extractApiError(undefined, 'fallback')).toEqual({ message: 'fallback' })
  })
})
