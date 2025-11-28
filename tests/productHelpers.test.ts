import { describe, it, expect } from 'vitest'
import {
  normalizeProduct,
  getTotalStock,
  isOutOfStock,
  isLowStock,
  hasVariations,
  calculatePriceTTC,
  calculatePriceHT
} from '@/utils/productHelpers'

describe('productHelpers', () => {
  describe('normalizeProduct', () => {
    it('nettoie les types (ids, stocks, variations)', () => {
      const raw = {
        id: '12',
        name: 'Test',
        barcode: 123,
        stock: '5',
        price: '10.5',
        tva: '10',
        variationGroupIds: ['1', 2],
        stockByVariation: { 'a': '2', 3: '4' },
        minStockByVariation: { 'a': '1', 3: '2' }
      }

      const normalized = normalizeProduct(raw)
      expect(normalized.id).toBe(12)
      expect(normalized.barcode).toBe('123')
      expect(normalized.stock).toBe(5)
      expect(normalized.price).toBe(10.5)
      expect(normalized.tva).toBe(10)
      expect(normalized.variationGroupIds).toEqual([1, 2])
      expect(normalized.stockByVariation).toEqual({ 'a': 2, '3': 4 })
      expect(normalized.minStockByVariation).toEqual({ 'a': 1, '3': 2 })
    })

    it('gère les valeurs manquantes avec des défauts', () => {
      const raw = { id: '5' }
      const normalized = normalizeProduct(raw)

      expect(normalized.id).toBe(5)
      expect(normalized.name).toBe('')
      expect(normalized.barcode).toBe('')
      expect(normalized.stock).toBe(0)
      expect(normalized.price).toBe(0)
      expect(normalized.tva).toBe(20) // défaut
      expect(normalized.minStock).toBe(0)
    })

    it('convertit les variationGroupIds correctement', () => {
      const raw = { id: 1, variationGroupIds: ['1', '2', 3] }
      const normalized = normalizeProduct(raw)
      expect(normalized.variationGroupIds).toEqual([1, 2, 3])
    })

    it('préserve les propriétés supplémentaires', () => {
      const raw = { id: 1, customField: 'test', category: 'food' }
      const normalized = normalizeProduct(raw)
      expect(normalized.customField).toBe('test')
      expect(normalized.category).toBe('food')
    })
  })

  describe('getTotalStock', () => {
    it('retourne le stock simple', () => {
      expect(getTotalStock({ id: 1, name: '', image: null, price: 0, tva: 20, stock: 5 })).toBe(5)
      expect(getTotalStock({ id: 1, name: '', image: null, price: 0, tva: 20, stock: 0 })).toBe(0)
    })

    it('additionne le stock par variation', () => {
      expect(getTotalStock({
        id: 1,
        name: '',
        image: null,
        price: 0,
        tva: 20,
        stock: 0,
        stockByVariation: { a: 2, b: 3 }
      })).toBe(5)
    })

    it('additionne plusieurs variations', () => {
      expect(getTotalStock({
        id: 1,
        name: '',
        image: null,
        price: 0,
        tva: 20,
        stock: 0,
        stockByVariation: { a: 10, b: 20, c: 5 }
      })).toBe(35)
    })

    it('gère les valeurs nulles dans stockByVariation', () => {
      expect(getTotalStock({
        id: 1,
        name: '',
        image: null,
        price: 0,
        tva: 20,
        stock: 0,
        stockByVariation: { a: 2, b: null as any, c: 3 }
      })).toBe(5)
    })
  })

  describe('hasVariations', () => {
    it('retourne true si le produit a des variationGroupIds', () => {
      expect(hasVariations({
        id: 1,
        name: '',
        image: null,
        price: 0,
        tva: 20,
        stock: 0,
        variationGroupIds: [1, 2]
      })).toBe(true)
    })

    it('retourne false si variationGroupIds est vide', () => {
      expect(hasVariations({
        id: 1,
        name: '',
        image: null,
        price: 0,
        tva: 20,
        stock: 0,
        variationGroupIds: []
      })).toBe(false)
    })

    it('retourne false si pas de variationGroupIds', () => {
      expect(hasVariations({
        id: 1,
        name: '',
        image: null,
        price: 0,
        tva: 20,
        stock: 5
      })).toBe(false)
    })
  })

  describe('isOutOfStock', () => {
    it('retourne false si stock > 0 par défaut', () => {
      const base = { id: 1, name: '', image: null, price: 0, tva: 20, stock: 1 }
      expect(isOutOfStock(base)).toBe(false)
    })

    it('retourne true si stock = 0', () => {
      const base = { id: 1, name: '', image: null, price: 0, tva: 20, stock: 0 }
      expect(isOutOfStock(base)).toBe(true)
    })

    it('respecte le seuil personnalisé', () => {
      const base = { id: 1, name: '', image: null, price: 0, tva: 20, stock: 5 }
      expect(isOutOfStock(base, 3)).toBe(false)
      expect(isOutOfStock(base, 5)).toBe(true)
      expect(isOutOfStock(base, 10)).toBe(true)
    })

    it('gère les produits avec variations', () => {
      const product = {
        id: 1,
        name: '',
        image: null,
        price: 0,
        tva: 20,
        stock: 0,
        stockByVariation: { a: 5, b: 5 }
      }
      expect(isOutOfStock(product)).toBe(false) // total = 10
      expect(isOutOfStock(product, 10)).toBe(true)
    })
  })

  describe('isLowStock', () => {
    it('retourne false si minStock = 0', () => {
      const noAlert = { id: 1, name: '', image: null, price: 0, tva: 20, stock: 5, minStock: 0 }
      expect(isLowStock(noAlert)).toBe(false)
    })

    it('retourne false si stock > minStock', () => {
      const noAlert = { id: 1, name: '', image: null, price: 0, tva: 20, stock: 5, minStock: 2 }
      expect(isLowStock(noAlert)).toBe(false)
    })

    it('retourne true si stock <= minStock', () => {
      const alertGlobal = { id: 1, name: '', image: null, price: 0, tva: 20, stock: 1, minStock: 2 }
      expect(isLowStock(alertGlobal)).toBe(true)
    })

    it('gère minStockByVariation correctement', () => {
      const variationsOk = {
        id: 1, name: '', image: null, price: 0, tva: 20,
        stock: 0,
        variationGroupIds: ['a', 'b'],
        stockByVariation: { a: 2, b: 3 },
        minStock: 0,
        minStockByVariation: { a: 1, b: 2 }
      }
      expect(isLowStock(variationsOk)).toBe(false)
    })

    it('détecte alerte sur une variation', () => {
      const variationsAlert = {
        id: 1, name: '', image: null, price: 0, tva: 20,
        stock: 0,
        variationGroupIds: ['a', 'b'],
        stockByVariation: { a: 1, b: 3 },
        minStock: 0,
        minStockByVariation: { a: 2, b: 1 }
      }
      expect(isLowStock(variationsAlert)).toBe(true)
    })

    it('ignore variations sans minStock', () => {
      const product = {
        id: 1, name: '', image: null, price: 0, tva: 20,
        stock: 0,
        variationGroupIds: ['a', 'b'],
        stockByVariation: { a: 1, b: 1 },
        minStock: 0,
        minStockByVariation: { a: 0, b: 0 }
      }
      expect(isLowStock(product)).toBe(false)
    })
  })

  describe('calculatePriceTTC', () => {
    it('calcule le prix TTC avec TVA 20%', () => {
      expect(calculatePriceTTC(100, 20)).toBe(120)
    })

    it('calcule le prix TTC avec TVA 10%', () => {
      expect(calculatePriceTTC(100, 10)).toBe(110)
    })

    it('calcule le prix TTC avec TVA 5.5%', () => {
      expect(calculatePriceTTC(100, 5.5)).toBe(105.5)
    })

    it('arrondit correctement', () => {
      expect(calculatePriceTTC(12.99, 20)).toBe(15.59)
    })

    it('gère les prix décimaux', () => {
      expect(calculatePriceTTC(9.99, 20)).toBe(11.99)
    })
  })

  describe('calculatePriceHT', () => {
    it('calcule le prix HT à partir du TTC avec TVA 20%', () => {
      expect(calculatePriceHT(120, 20)).toBe(100)
    })

    it('calcule le prix HT à partir du TTC avec TVA 10%', () => {
      expect(calculatePriceHT(110, 10)).toBe(100)
    })

    it('arrondit correctement', () => {
      expect(calculatePriceHT(15.59, 20)).toBe(12.99)
    })

    it('gère les prix décimaux', () => {
      expect(calculatePriceHT(11.99, 20)).toBe(9.99)
    })
  })
})
