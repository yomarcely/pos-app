import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProductsStore } from '@/stores/products'

// Désactiver les logs dans les tests pour éviter le bruit
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

const baseProduct = {
  id: 1,
  name: 'Produit simple',
  price: 10,
  image: null,
  tva: 20,
  stock: 5,
  minStock: 2
}

const variationProduct = {
  id: 2,
  name: 'Produit varié',
  price: 20,
  image: null,
  tva: 20,
  stock: 0,
  stockByVariation: { red: 1, blue: 0 },
  minStockByVariation: { red: 2, blue: 1 }
}

describe('products store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hasEnoughStock/getAvailableStock gèrent variations et stock global', () => {
    const store = useProductsStore()
    store.products = [baseProduct as any, variationProduct as any]

    expect(store.hasEnoughStock(1, '', 3)).toBe(true)
    expect(store.getAvailableStock(1)).toBe(5)
    expect(store.hasEnoughStock(1, '', 10)).toBe(false)

    expect(store.hasEnoughStock(2, 'red', 1)).toBe(true)
    expect(store.hasEnoughStock(2, 'blue', 1)).toBe(false)
    expect(store.getAvailableStock(2, 'red')).toBe(1)
  })

  it('outOfStockAlerts/lowStockAlerts traitent les variations', () => {
    const store = useProductsStore()
    store.products = [variationProduct as any]

    const outAlerts = store.outOfStockAlerts
    expect(outAlerts).toHaveLength(1)
    expect(outAlerts[0]!.variations).toEqual([{ id: 'blue', name: 'Variation blue', stock: 0 }])

    const lowAlerts = store.lowStockAlerts
    expect(lowAlerts).toHaveLength(1)
    expect(lowAlerts[0]!.variations).toEqual([{ id: 'red', name: 'Variation red', stock: 1 }])
  })
})
