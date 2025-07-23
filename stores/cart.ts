import { defineStore } from 'pinia'
import type { ProductBase, ProductInCart } from '@/types'
import { useTicketsStore } from './tickets'

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as ProductInCart[],
    tva: 0.20,
    globalDiscount: 0,
    globalDiscountType: '%' as '%' | '€'
  }),

  getters: {
    getFinalPrice(state) {
      return (product: ProductInCart): number => {
        // Remise produit
        let price = product.discountType === '%'
          ? product.price * (1 - product.discount / 100)
          : product.price - product.discount

        // Remise globale
        if (state.globalDiscountType === '%') {
          price *= (1 - state.globalDiscount / 100)
        } else if (state.globalDiscountType === '€') {
          const totalBefore = state.items.reduce((sum, p) => {
            const base = p.discountType === '%'
              ? p.price * (1 - p.discount / 100)
              : p.price - p.discount
            return sum + base * p.quantity
          }, 0)

          if (totalBefore > 0) {
            const productBaseTotal = (product.discountType === '%'
              ? product.price * (1 - product.discount / 100)
              : product.price - product.discount) * product.quantity

            const prorata = productBaseTotal / totalBefore
            const discountPerUnit = (state.globalDiscount * prorata) / product.quantity
            price -= discountPerUnit
          }
        }
        console.log(`[${product.name}] Prix base: ${product.price}, remise: ${product.discount}${product.discountType}, final: ${price}`)

        return Math.max(0, Math.round(price * 100) / 100)
      }
    },

    totalHT(state): number {
      return state.items.reduce((sum, item) => {
        const priceTTC = this.getFinalPrice(item)
        const tvaRate = item.tva ?? 20
        const priceHT = priceTTC / (1 + tvaRate / 100)
        return sum + priceHT * item.quantity
      }, 0)
    },

    totalTVA(state): number {
      return state.items.reduce((sum, item) => {
        const price = this.getFinalPrice(item)
        const tva = item.tva ?? 20
        const tvaPart = price * (tva / (100 + tva))
        return sum + tvaPart * item.quantity
      }, 0)
    },

    totalTTC(state): number {
      return state.items.reduce((sum, item) => {
        const price = this.getFinalPrice(item)
        return sum + price * item.quantity
      }, 0)
    },

    itemCount(state): number {
      return state.items.reduce((sum, item) => sum + item.quantity, 0)
    }
  },

  actions: {
    addToCart(product: ProductBase, variation = '') {
      const existing = this.items.find(
        item => item.id === product.id && item.variation === variation
      )

      if (existing) {
        existing.quantity++
      } else {
        this.items.push({
          ...product,
          quantity: 1,
          discount: 0,
          discountType: '%',
          variation
        })
      }
    },

    removeFromCart(id: number, variation = '') {
      this.items = this.items.filter(
        item => !(item.id === id && item.variation === variation)
      )
    },

    clearCart() {
      this.items = []
    },

    updateQuantity(productId: number, variation: string, quantity: number) {
      const item = this.items.find(p => p.id === productId && p.variation === variation)
      if (item) {
        item.quantity = quantity
      }
    },

    updateDiscount(productId: number, variation: string, discount: number, type: '%' | '€') {
      const item = this.items.find(p => p.id === productId && p.variation === variation)
      if (item) {
        item.discount = discount
        item.discountType = type
      }
    },

    updateGlobalDiscount(value: number, type: '%' | '€') {
      this.globalDiscount = value
      this.globalDiscountType = type
    },

    holdSale(ticketId: number | null = null, clientId: number | null = null) {
      const tickets = useTicketsStore()
      tickets.addTicket(this.items, this.totalTTC, ticketId, clientId)
      this.clearCart()
    }
  }
})
