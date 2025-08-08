import { describe, it, expect } from 'vitest'
import type { ProductInCart } from '@/types/pos'
import {
  totalTTC, totalHT, totalTVA,
  getFinalPrice, type GlobalDiscount
} from '@/utils/cartUtils'

// helper pour créer des produits complets
function mockProductInCart(partial: Partial<ProductInCart>): ProductInCart {
  return {
    id: 0,
    name: 'Produit test',
    image: '',
    variation: '',
    price: 0,
    quantity: 1,
    discount: 0,
    discountType: '%',
    tva: 20,
    ...partial
  }
}

const baseItems: ProductInCart[] = [
  mockProductInCart({ id: 1, price: 10, quantity: 2, tva: 20 }),
  mockProductInCart({ id: 2, price: 5, quantity: 1, tva: 10 })
]

describe('Calculs panier', () => {
  it('Sans remise globale', () => {
    const global: GlobalDiscount = { value: 0, type: '%' }
    expect(totalTTC(baseItems, global)).toBe(25)
    expect(totalHT(baseItems, global)).toBeCloseTo(21.22, 2) // ✅ correct
    expect(totalTVA(baseItems, global)).toBeCloseTo(3.78, 2) // ✅ 25 - 21.22
  })

  it('Remise globale % (10%)', () => {
    const global: GlobalDiscount = { value: 10, type: '%' }
    expect(totalTTC(baseItems, global)).toBe(22.5)
    expect(totalHT(baseItems, global)).toBeCloseTo(19.09, 2) // ✅ par ligne
    expect(totalTVA(baseItems, global)).toBeCloseTo(3.41, 2) // ✅ 22.5 - 19.09
  })

  it('Remise globale € (5€)', () => {
    const global: GlobalDiscount = { value: 5, type: '€' }
    expect(totalTTC(baseItems, global)).toBe(20)
    expect(totalHT(baseItems, global)).toBeCloseTo(16.97, 2) // ✅ allocation 4€/1€
    expect(totalTVA(baseItems, global)).toBeCloseTo(3.03, 2) // ✅ 20 - 16.97
  })

  it('getFinalPrice cohérent avec totalTTC', () => {
    const global: GlobalDiscount = { value: 5, type: '€' }
    const prices = baseItems.map(it => getFinalPrice(it, baseItems, global))
    const total = prices.reduce((s, p, i) => s + p * baseItems[i]!.quantity, 0)
    expect(total).toBeCloseTo(totalTTC(baseItems, global), 2)
  })
})
