import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'
import { useVariationGroupsStore } from '@/stores/variationGroups'

// Mock du customer store pour éviter les dépendances externes
vi.mock('@/stores/customer', () => ({
  useCustomerStore: () => ({
    clients: [],
    selectClient: vi.fn(),
    clearClient: vi.fn()
  })
}))

const product = {
  id: 1,
  name: 'Produit test',
  image: null,
  price: 10,
  tva: 20,
  stock: 5
}

describe('cart store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('addToCart incrémente et merge sur la même variation', () => {
    const cart = useCartStore()
    cart.addToCart(product as any)
    cart.addToCart(product as any)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]!.quantity).toBe(2)
  })

  it('updateVariation fusionne si la variation cible existe déjà', () => {
    const cart = useCartStore()
    cart.addToCart(product as any, 'red')
    cart.addToCart(product as any, 'blue')

    cart.updateVariation(1, 'blue', 'red')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]!.variation).toBe('red')
    expect(cart.items[0]!.quantity).toBe(2)
  })

  it('addToCart porte le variationId explicite, sinon le résout par NOM parmi les variations du produit', () => {
    const cart = useCartStore()
    const variationStore = useVariationGroupsStore()
    variationStore.groups = [
      { id: 1, name: 'Taille', variations: [{ id: 152, name: '38' }, { id: 7, name: 'Rouge' }] },
    ] as any

    const p = { ...product, id: 2, variationGroupIds: [152, 7] }

    // ID explicite fourni par la caisse
    cart.addToCart(p as any, '38', 152)
    expect(cart.items[0]!.variationId).toBe(152)

    // Résolution par nom (raccourci / panier persisté) — un nom numérique
    // n'est jamais interprété comme un ID
    cart.addToCart(p as any, 'Rouge')
    expect(cart.items[1]!.variationId).toBe(7)
  })

  it('updateVariation met à jour le variationId (résolu par nom si non fourni)', () => {
    const cart = useCartStore()
    const variationStore = useVariationGroupsStore()
    variationStore.groups = [
      { id: 1, name: 'Taille', variations: [{ id: 152, name: '38' }, { id: 7, name: 'Rouge' }] },
    ] as any

    const p = { ...product, id: 2, variationGroupIds: [152, 7] }
    cart.addToCart(p as any, '38', 152)

    cart.updateVariation(2, '38', 'Rouge')
    expect(cart.items[0]!.variation).toBe('Rouge')
    expect(cart.items[0]!.variationId).toBe(7)
  })

  it('validateStock retourne une erreur si stock insuffisant', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const productsStore = useProductsStore()
    productsStore.products = [{
      ...product,
      stockByVariation: { red: 0 }
    } as any]

    const cart = useCartStore()
    cart.addToCart(product as any, 'red')
    cart.updateQuantity(1, 'red', 3)

    const res = cart.validateStock()
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('disponible 0')
  })

  // --- Tests de caractérisation des totaux (zone critique CLAUDE.md) ---
  // Figent le comportement actuel des getters AVANT toute modification du store.

  it('caractérisation : totaux TTC/HT/TVA sans remise', () => {
    const cart = useCartStore()
    cart.addToCart(product as any) // 10 € TTC, TVA 20%
    cart.updateQuantity(1, '', 3)

    expect(cart.totalTTC).toBe(30)
    expect(cart.totalHT).toBe(25)
    expect(cart.totalTVA).toBe(5)
    expect(cart.itemCount).toBe(3)
  })

  it('caractérisation : totaux avec remise ligne en %', () => {
    const cart = useCartStore()
    cart.addToCart(product as any)
    cart.updateQuantity(1, '', 2)
    cart.updateDiscount(1, '', 10, '%')

    expect(cart.totalTTC).toBe(18)
    expect(cart.totalHT).toBe(15)
    expect(cart.totalTVA).toBe(3)
  })

  it('caractérisation : totaux avec remise ligne en €', () => {
    const cart = useCartStore()
    cart.addToCart(product as any)
    cart.updateDiscount(1, '', 2, '€')

    expect(cart.totalTTC).toBe(8)
    expect(cart.getFinalPrice(cart.items[0]!)).toBe(8)
  })

  it('caractérisation : getFinalPrice reflète la remise %', () => {
    const cart = useCartStore()
    cart.addToCart(product as any)
    cart.updateDiscount(1, '', 25, '%')

    expect(cart.getFinalPrice(cart.items[0]!)).toBe(7.5)
  })

  it('caractérisation : la remise globale non appliquée ne change pas les totaux', () => {
    const cart = useCartStore()
    cart.addToCart(product as any)
    cart.updateGlobalDiscount(50, '%')

    // Les totaux ignorent globalDiscount tant qu'applyGlobalDiscountToItems n'est pas appelé
    expect(cart.totalTTC).toBe(10)
  })

  it('applyGlobalDiscountToItems applique la remise % ou €', () => {
    const cart = useCartStore()
    cart.addToCart(product as any)
    cart.updateGlobalDiscount(10, '%')
    cart.applyGlobalDiscountToItems()
    expect(cart.items[0]!.discount).toBe(10)
    expect(cart.items[0]!.discountType).toBe('%')

    cart.clearCart()
    cart.addToCart(product as any)
    cart.updateGlobalDiscount(5, '€')
    cart.applyGlobalDiscountToItems()
    expect(cart.items[0]!.discountType).toBe('€')
    expect(cart.items[0]!.discount).toBeGreaterThan(0)
  })

  describe('clientSaleId (idempotence)', () => {
    it('est généré au premier article et stable pendant la vente', () => {
      const cart = useCartStore()
      expect(cart.clientSaleId).toBeNull()

      cart.addToCart(product as any)
      const first = cart.clientSaleId
      expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

      cart.addToCart(product as any)
      expect(cart.clientSaleId).toBe(first)
    })

    it('est régénéré après clearCart (nouvelle vente = nouvel UUID)', () => {
      const cart = useCartStore()
      cart.addToCart(product as any)
      const first = cart.clientSaleId

      cart.clearCart()
      expect(cart.clientSaleId).toBeNull()

      cart.addToCart(product as any)
      expect(cart.clientSaleId).not.toBeNull()
      expect(cart.clientSaleId).not.toBe(first)
    })
  })
})
