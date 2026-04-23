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

import { recomputeTotalTTC, validateTotalTTC, assertHTplusTVAequalsTTC, recomputeHTandTVA } from '~/server/utils/financialValidation'
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

describe('Q8 — recomputeHTandTVA', () => {
  it('décompose un item TVA 20% (100€ TTC → 83.33 HT + 16.67 TVA)', () => {
    const r = recomputeHTandTVA([{ unitPrice: 100, quantity: 1, tva: 20 }])
    expect(r.totalHT).toBe(83.33)
    expect(r.totalTVA).toBe(16.67)
  })

  it('décompose un item TVA 5.5% (10.55€ TTC → 10.00 HT + 0.55 TVA)', () => {
    const r = recomputeHTandTVA([{ unitPrice: 10.55, quantity: 1, tva: 5.5 }])
    expect(r.totalHT).toBe(10)
    expect(r.totalTVA).toBe(0.55)
  })

  it('somme correctement plusieurs lignes même TVA', () => {
    const r = recomputeHTandTVA([
      { unitPrice: 50, quantity: 1, tva: 20 },
      { unitPrice: 50, quantity: 1, tva: 20 },
    ])
    expect(r.totalHT + r.totalTVA).toBe(100)
  })

  it('somme correctement plusieurs lignes multi-TVA', () => {
    // 60€ TTC à 20% (50 HT + 10 TVA) + 21.10€ TTC à 5.5% (20 HT + 1.10 TVA)
    const r = recomputeHTandTVA([
      { unitPrice: 60, quantity: 1, tva: 20 },
      { unitPrice: 21.10, quantity: 1, tva: 5.5 },
    ])
    expect(r.totalHT).toBeCloseTo(70, 2)
    expect(r.totalTVA).toBeCloseTo(11.10, 2)
  })

  it('respecte HT + TVA = TTC à 1 centime près', () => {
    const items = [
      { unitPrice: 9.99, quantity: 3, tva: 20 },
      { unitPrice: 4.50, quantity: 2, tva: 10 },
      { unitPrice: 1.20, quantity: 5, tva: 5.5 },
    ]
    const r = recomputeHTandTVA(items)
    const ttc = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    expect(Math.abs((r.totalHT + r.totalTVA) - ttc)).toBeLessThanOrEqual(0.01)
  })

  it('retourne 0/0 pour un panier vide', () => {
    expect(recomputeHTandTVA([])).toEqual({ totalHT: 0, totalTVA: 0 })
  })

  it('détecte une fraude : payload TVA = 0 sur ligne taxée', () => {
    // Si l'attaquant envoie tva: 0 mais le vrai taux était 20%, le HT/TVA recalculés
    // ne matchent pas le vrai HT/TVA. Test que le recalcul utilise bien le taux passé.
    const real = recomputeHTandTVA([{ unitPrice: 120, quantity: 1, tva: 20 }])
    const fake = recomputeHTandTVA([{ unitPrice: 120, quantity: 1, tva: 0 }])
    expect(real.totalTVA).toBe(20)
    expect(fake.totalTVA).toBe(0)
    // → c'est au handler de comparer le payload TVA au recalcul serveur (cf. Q8)
  })
})
