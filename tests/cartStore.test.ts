import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'

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
})
