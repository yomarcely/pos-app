import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Product, ProductInCart } from '@/types'
import { useCustomerStore } from '@/stores/customer'
import { useProductsStore } from '@/stores/products'

import {
  getFinalPrice,
  totalTTC,
  totalHT,
  totalTVA
} from '@/utils/cartUtils'

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
  const zeroGlobal = { value: 0, type: '%' as '%' }

  function addPendingCart(clientId: number | null = null) {
    if (!items.value.length) return

    pendingCart.value.push({
      id: nextPendingId++,
      items: JSON.parse(JSON.stringify(items.value)),
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

    // Appliquer les données du panier (sans vérification de stock car on permet les stocks négatifs)
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

  // Totaux ne prennent pas la remise globale tant qu'elle n'est pas appliquée
  const totalTtcComputed = computed(() => totalTTC(items.value, zeroGlobal))
  const totalHtComputed = computed(() => totalHT(items.value, zeroGlobal))
  const totalTvaComputed = computed(() => totalTVA(items.value, zeroGlobal))

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
  
  /**
   * Ajoute un produit au panier (permet les stocks négatifs)
   * @param product - Produit à ajouter
   * @param variation - Variation du produit (optionnel)
   * @returns true si l'ajout a réussi
   */
  function addToCart(product: Product, variation = ''): boolean {
    // Vérifier si le produit existe déjà dans le panier
    const existing = items.value.find(
      item => item.id === product.id && item.variation === variation
    )

    // Ajouter ou incrémenter (sans vérification de stock)
    if (existing) {
      existing.quantity++
    } else {
      items.value.push({
        ...product,
        quantity: 1,
        discount: 0,
        discountType: '%',
        variation,
        restockOnReturn: false,
      })
    }

    return true
  }

  function removeFromCart(id: number, variation = '') {
    items.value = items.value.filter(
      item => !(item.id === id && item.variation === variation)
    )
  }

  function clearCart() {
    items.value = []
    globalDiscount.value = 0
    globalDiscountType.value = '%'
    const customerStore = useCustomerStore()
    customerStore.clearClient?.()
  }

  /**
   * Met à jour la quantité d'un produit dans le panier (permet les stocks négatifs)
   * @param productId - ID du produit
   * @param variation - Variation du produit
   * @param quantity - Nouvelle quantité
   * @returns true si la mise à jour a réussi
   */
  function updateQuantity(
    productId: number,
    variation: string,
    quantity: number
  ): boolean {
    const item = items.value.find(
      p => p.id === productId && p.variation === variation
    )
    if (!item) return false

    item.quantity = quantity
    return true
  }

  function updateDiscount(
    productId: number,
    variation: string,
    discount: number,
    type: '%' | '€'
  ) {
    const item = items.value.find(
      p => p.id === productId && p.variation === variation
    )
    if (item) {
      item.discount = discount
      item.discountType = type
    }
  }

  function updateGlobalDiscount(value: number, type: '%' | '€') {
    globalDiscount.value = value
    globalDiscountType.value = type
  }

  /**
   * Applique la remise globale sur chaque produit du panier
   * et réinitialise la remise globale à 0
   */
  function applyGlobalDiscountToItems() {
    if (items.value.length === 0 || globalDiscount.value === 0) return

    if (globalDiscountType.value === '%') {
      // Pour une remise en %, on applique le même pourcentage sur chaque produit
      items.value.forEach(item => {
        item.discount = globalDiscount.value
        item.discountType = '%'
      })
    } else {
      // Pour une remise en €, on répartit proportionnellement au prix de chaque ligne
      // 1. Calculer le total du panier (sans remise)
      const total = items.value.reduce((sum, item) => {
        const unitPrice = item.discountType === '%'
          ? item.price * (1 - item.discount / 100)
          : item.price - item.discount
        return sum + (unitPrice * item.quantity)
      }, 0)

      if (total <= 0) return

      // 2. Calculer la remise proportionnelle pour chaque produit
      items.value.forEach(item => {
        const unitPrice = item.discountType === '%'
          ? item.price * (1 - item.discount / 100)
          : item.price - item.discount
        const lineTotal = unitPrice * item.quantity
        const proportion = lineTotal / total
        const itemDiscount = Math.round(globalDiscount.value * proportion * 100) / 100

        // Appliquer la remise en € sur ce produit
        item.discount = itemDiscount
        item.discountType = '€'
      })
    }

    // Réinitialiser la remise globale
    globalDiscount.value = 0
    globalDiscountType.value = '%'
  }

  function updateVariation(
    productId: number,
    oldVariation: string,
    newVariation: string
  ) {
    const item = items.value.find(
      p => p.id === productId && p.variation === oldVariation
    )
    if (!item) return

    const existing = items.value.find(
      p => p.id === productId && p.variation === newVariation
    )

    // Si la variation existe déjà, fusionner les quantités
    if (existing && existing !== item) {
      existing.quantity += item.quantity
      removeFromCart(productId, oldVariation)
    } else {
      item.variation = newVariation
    }
  }

  /**
   * Valide que tous les produits du panier ont assez de stock
   * @returns true si tout est OK, false sinon
   */
  function validateStock(): { valid: boolean; errors: string[] } {
    const productsStore = useProductsStore()
    const errors: string[] = []

    for (const item of items.value) {
      if (!productsStore.hasEnoughStock(item.id, item.variation, item.quantity)) {
        const availableStock = productsStore.getAvailableStock(item.id, item.variation)
        errors.push(
          `${item.name} ${item.variation ? `(${item.variation})` : ''}: ` +
          `demandé ${item.quantity}, disponible ${availableStock}`
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors
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
    getFinalPrice: (product: ProductInCart) =>
      getFinalPrice(product, items.value, zeroGlobal),
    totalTTC: totalTtcComputed,
    totalHT: totalHtComputed,
    totalTVA: totalTvaComputed,
    itemCount,

    // actions
    addToCart,
    removeFromCart,
    clearCart,
    updateQuantity,
    updateDiscount,
    updateGlobalDiscount,
    applyGlobalDiscountToItems,
    updateVariation,
    addPendingCart,
    recoverPendingCart,
    validateStock
  }
})
