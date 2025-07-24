import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Product, ProductInCart } from '@/types'

export const useCartStore = defineStore('cart', () => {
  // --- ÉTAT ---
  const items = ref<ProductInCart[]>([])
  const selectedProduct = ref<Product | null>(null)
  const globalDiscount = ref(0)
  const globalDiscountType = ref<'%' | '€'>('%')

  // --- TICKETS EN ATTENTE ---
  const pendingCart = ref<{
    id: number
    items: ProductInCart[]
    globalDiscount: number
    globalDiscountType: '%' | '€'
    clientId: number | null
  }[]>([])

  let nextPendingId = 1

  function addPendingCart(clientId: number | null = null) {
    if (!items.value.length) return

    pendingCart.value.push({
      id: nextPendingId++,
      items: JSON.parse(JSON.stringify(items.value)), // deep clone
      globalDiscount: globalDiscount.value,
      globalDiscountType: globalDiscountType.value,
      clientId
    })

    clearCart()
  }

  function recoverPendingCart(id: number) {
  const index = pendingCart.value.findIndex(c => c.id === id)
  if (index === -1) return

  const cartData = pendingCart.value[index]
  if (!cartData) return

  // Appliquer les données du panier
  items.value = cartData.items
  globalDiscount.value = cartData.globalDiscount
  globalDiscountType.value = cartData.globalDiscountType

  // Gérer le client
  const customerStore = useCustomerStore()
  if (cartData.clientId !== null) {
    const client = customerStore.clients.find(c => c.id === cartData.clientId)
    if (client) {
      customerStore.selectClient(client)
    } else {
      customerStore.clearClient()
    }
  } else {
    customerStore.clearClient()
  }

  // Supprimer le panier
  pendingCart.value.splice(index, 1)
}


  // --- GETTERS ---
  function getFinalPrice(product: ProductInCart): number {
    let price = product.discountType === '%'
      ? product.price * (1 - product.discount / 100)
      : product.price - product.discount

    if (globalDiscountType.value === '%') {
      price *= (1 - globalDiscount.value / 100)
    } else if (globalDiscountType.value === '€') {
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
  function addToCart(product: Product, variation = '') {
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
        existing.quantity += item.quantity
        removeFromCart(productId, oldVariation)
      } else {
        item.variation = newVariation
      }
    }
  }

  return {
    // état
    items,
    selectedProduct,
    globalDiscount,
    globalDiscountType,
    pendingCart,
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
    addPendingCart,
    recoverPendingCart
  }
})
