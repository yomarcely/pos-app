import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ProductBase, ProductInCart } from '@/types'
import { useTicketsStore } from './tickets'

export const useCartStore = defineStore('cart', () => {
  // --- ÉTAT ---
  const items = ref<ProductInCart[]>([])
  const selectedProduct = ref<ProductBase | null>(null)
  const tva = ref(0.20)
  const globalDiscount = ref(0)
  const globalDiscountType = ref<'%' | '€'>('%')

  // --- GETTERS ---
  function getFinalPrice(product: ProductInCart): number {
    let price = product.discountType === '%'
      ? product.price * (1 - product.discount / 100)
      : product.price - product.discount

    if (globalDiscountType.value === '%') {
      // Remise globale en pourcentage
      price *= (1 - globalDiscount.value / 100)
    } else if (globalDiscountType.value === '€') {
      // Remise globale fixe : répartition proportionnelle entre les produits
      const totalBefore = items.value.reduce((sum, p) => {
        const base = p.discountType === '%'
          ? p.price * (1 - p.discount / 100)
          : p.price - p.discount
        return sum + base * p.quantity
      }, 0)
      if (totalBefore > 0) {
        const productBaseTotal = (
          product.discountType === '%'
            ? product.price * (1 - product.discount / 100)
            : product.price - product.discount
        ) * product.quantity
        const prorata = productBaseTotal / totalBefore
        const discountPerUnit = (globalDiscount.value * prorata) / product.quantity
        price -= discountPerUnit
      }
    }
    // Arrondi à 2 décimales et minimum 0
    return Math.max(0, Math.round(price * 100) / 100)
  }

  const totalHT = computed(() =>
    items.value.reduce((sum, item) => {
      const priceTTC = getFinalPrice(item)
      const tvaRate = item.tva ?? 20
      const priceHT = priceTTC / (1 + tvaRate / 100)
      return sum + priceHT * item.quantity
    }, 0)
  )
  const totalTVA = computed(() =>
    items.value.reduce((sum, item) => {
      const price = getFinalPrice(item)
      const tvaRate = item.tva ?? 20
      const tvaPart = price * (tvaRate / (100 + tvaRate))
      return sum + tvaPart * item.quantity
    }, 0)
  )
  const totalTTC = computed(() =>
    items.value.reduce((sum, item) => {
      const price = getFinalPrice(item)
      return sum + price * item.quantity
    }, 0)
  )
  const itemCount = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  // --- RÉACTIONS ---
  watch(selectedProduct, (product) => {
    if (product) {
      addToCart(product)
      selectedProduct.value = null
    }
  })

  // --- ACTIONS ---
  function addToCart(product: ProductBase, variation = '') {
    const existing = items.value.find(item => item.id === product.id && item.variation === variation)
    if (existing) {
      existing.quantity++
    } else {
      items.value.push({
        ...product,
        quantity: 1,
        discount: 0,
        discountType: '%',
        variation
      })
    }
  }

  function removeFromCart(id: number, variation = '') {
    items.value = items.value.filter(item => !(item.id === id && item.variation === variation))
  }

  function clearCart() {
    items.value = []
    globalDiscount.value = 0
    globalDiscountType.value = '%'
  }

  function updateQuantity(productId: number, variation: string, quantity: number) {
    const item = items.value.find(p => p.id === productId && p.variation === variation)
    if (item) {
      item.quantity = quantity
    }
  }

  function updateDiscount(productId: number, variation: string, discount: number, type: '%' | '€') {
    const item = items.value.find(p => p.id === productId && p.variation === variation)
    if (item) {
      item.discount = discount
      item.discountType = type
    }
  }

  function updateGlobalDiscount(value: number, type: '%' | '€') {
    globalDiscount.value = value
    globalDiscountType.value = type
  }

  function updateVariation(productId: number, oldVariation: string, newVariation: string) {
    const item = items.value.find(p => p.id === productId && p.variation === oldVariation)
    if (item) {
      const existing = items.value.find(p => p.id === productId && p.variation === newVariation)
      if (existing && existing !== item) {
        // Fusionne avec l'élément existant de même variation
        existing.quantity += item.quantity
        // On pourrait aussi gérer la remise ici si nécessaire
        removeFromCart(productId, oldVariation)
      } else {
        item.variation = newVariation
      }
    }
  }

  function holdSale(ticketId: number | null = null, clientId: number | null = null) {
    const tickets = useTicketsStore()
    tickets.addTicket(items.value, totalTTC.value, ticketId, clientId)
    clearCart()
  }

  return {
    // état
    items,
    selectedProduct,
    tva,
    globalDiscount,
    globalDiscountType,
    // getters
    getFinalPrice,
    totalHT,
    totalTVA,
    totalTTC,
    itemCount,
    // actions
    addToCart,
    removeFromCart,
    clearCart,
    updateQuantity,
    updateDiscount,
    updateGlobalDiscount,
    updateVariation,
    holdSale
  }
})
