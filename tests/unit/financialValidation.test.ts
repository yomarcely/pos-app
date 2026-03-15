import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}))

import { recomputeTotalTTC, validateTotalTTC, assertHTplusTVAequalsTTC } from '~/server/utils/financialValidation'
import { logger } from '~/server/utils/logger'

describe('recomputeTotalTTC', () => {
  it('calcule correctement avec quantité entière', () => {
    const result = recomputeTotalTTC([{ unitPrice: 10, quantity: 3 }])
    expect(result).toBe(30)
  })

  it('gère la remise de ligne', () => {
    // 10€ avec 10% de remise × 2 = 9 × 2 = 18€
    const result = recomputeTotalTTC([{ unitPrice: 10, quantity: 2, lineDiscount: 10 }])
    expect(result).toBe(18)
  })

  it("évite l'erreur float classique 0.1 + 0.2", () => {
    // 0.1 + 0.2 = 0.30000000000000004 en float JS
    const result = recomputeTotalTTC([
      { unitPrice: 0.1, quantity: 1 },
      { unitPrice: 0.2, quantity: 1 },
    ])
    expect(result).toBe(0.30)
  })

  it('calcule correctement 1.10€ × 3 = 3.30€ (pas 3.3000000000000003€)', () => {
    // 1.10 * 3 = 3.3000000000000003 en float JS
    const result = recomputeTotalTTC([{ unitPrice: 1.10, quantity: 3 }])
    expect(result).toBe(3.30)
    // Vérifier aussi la précision de la représentation
    expect(result.toFixed(2)).toBe('3.30')
  })

  it('calcule correctement pour plusieurs lignes', () => {
    const result = recomputeTotalTTC([
      { unitPrice: 9.99, quantity: 2 },
      { unitPrice: 5.50, quantity: 1 },
    ])
    // 9.99 * 2 = 19.98, 5.50 * 1 = 5.50, total = 25.48
    expect(result).toBe(25.48)
  })

  it('retourne 0 pour un tableau vide', () => {
    expect(recomputeTotalTTC([])).toBe(0)
  })
})

describe('validateTotalTTC', () => {
  it('accepte un écart de 0 centime', () => {
    expect(validateTotalTTC(10.00, 10.00)).toBe(true)
  })

  it('accepte un écart de 1 centime (LRM)', () => {
    expect(validateTotalTTC(10.01, 10.00)).toBe(true)
    expect(validateTotalTTC(10.00, 10.01)).toBe(true)
  })

  it('accepte un écart de 2 centimes (tolérance)', () => {
    expect(validateTotalTTC(10.02, 10.00)).toBe(true)
    expect(validateTotalTTC(10.00, 10.02)).toBe(true)
  })

  it('rejette un écart de 3 centimes', () => {
    expect(validateTotalTTC(10.03, 10.00)).toBe(false)
    expect(validateTotalTTC(10.00, 10.03)).toBe(false)
  })

  it('rejette un écart de 10 centimes', () => {
    expect(validateTotalTTC(10.10, 10.00)).toBe(false)
    expect(validateTotalTTC(10.00, 10.10)).toBe(false)
  })

  it('fonctionne avec une tolérance personnalisée', () => {
    expect(validateTotalTTC(10.05, 10.00, 5)).toBe(true)
    expect(validateTotalTTC(10.06, 10.00, 5)).toBe(false)
  })
})

describe('assertHTplusTVAequalsTTC', () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear()
  })

  it('ne loggue pas quand HT + TVA = TTC exact', () => {
    assertHTplusTVAequalsTTC(83.33, 16.67, 100.00, 'test')
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })

  it('ne loggue pas quand écart = 1 centime', () => {
    // 83.33 + 16.67 = 100.00, arrondi HT peut donner 1 centime d'écart
    assertHTplusTVAequalsTTC(83.34, 16.67, 100.00, 'test')
    // sumCents = 8334 + 1667 = 10001, ttcCents = 10000, écart = 1 → pas de warning
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })

  it('loggue un warning quand écart > 1 centime', () => {
    // sumCents = 8400 + 1700 = 10100, ttcCents = 10000, écart = 100 → warning
    assertHTplusTVAequalsTTC(84.00, 17.00, 100.00, 'test')
    expect(vi.mocked(logger.warn)).toHaveBeenCalledOnce()
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'test',
        totalHT: 84.00,
        totalTVA: 17.00,
        totalTTC: 100.00,
      }),
      'Incohérence HT+TVA≠TTC dans la clôture'
    )
  })

  it('ne throw pas même avec un grand écart', () => {
    expect(() => {
      assertHTplusTVAequalsTTC(0, 0, 1000.00, 'test')
    }).not.toThrow()
    expect(vi.mocked(logger.warn)).toHaveBeenCalled()
  })
})
