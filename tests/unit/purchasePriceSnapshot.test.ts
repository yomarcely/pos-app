import { describe, it, expect } from 'vitest'
import { resolvePurchasePriceAtSale } from '~/server/utils/purchasePriceSnapshot'

describe('resolvePurchasePriceAtSale', () => {
  it('renvoie l\'override quand il existe (priorité établissement > global)', () => {
    const base = new Map<number, string | null>([[1, '5.00']])
    const override = new Map<number, string | null>([[1, '4.50']])

    expect(resolvePurchasePriceAtSale(1, base, override)).toBe('4.50')
  })

  it('fallback sur le prix global si override absent', () => {
    const base = new Map<number, string | null>([[1, '5.00']])
    const override = new Map<number, string | null>()

    expect(resolvePurchasePriceAtSale(1, base, override)).toBe('5.00')
  })

  it('fallback sur le prix global si override est null (entrée présente mais sans valeur)', () => {
    const base = new Map<number, string | null>([[1, '5.00']])
    const override = new Map<number, string | null>([[1, null]])

    expect(resolvePurchasePriceAtSale(1, base, override)).toBe('5.00')
  })

  it('renvoie null si ni override ni base ne sont définis', () => {
    const base = new Map<number, string | null>()
    const override = new Map<number, string | null>()

    expect(resolvePurchasePriceAtSale(42, base, override)).toBeNull()
  })

  it('renvoie null si base est null et pas d\'override', () => {
    const base = new Map<number, string | null>([[1, null]])
    const override = new Map<number, string | null>()

    expect(resolvePurchasePriceAtSale(1, base, override)).toBeNull()
  })

  it('respecte un override à "0.00" (produit gratuit côté achat) sans fallback', () => {
    const base = new Map<number, string | null>([[1, '5.00']])
    const override = new Map<number, string | null>([[1, '0.00']])

    expect(resolvePurchasePriceAtSale(1, base, override)).toBe('0.00')
  })

  it('isole correctement chaque productId', () => {
    const base = new Map<number, string | null>([
      [1, '5.00'],
      [2, '10.00'],
    ])
    const override = new Map<number, string | null>([[2, '8.00']])

    expect(resolvePurchasePriceAtSale(1, base, override)).toBe('5.00')
    expect(resolvePurchasePriceAtSale(2, base, override)).toBe('8.00')
    expect(resolvePurchasePriceAtSale(3, base, override)).toBeNull()
  })
})
