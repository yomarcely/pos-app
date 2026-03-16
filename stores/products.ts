import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Product } from '@/types'
import { useVariationGroupsStore } from './variationGroups'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { extractFetchError } from '@/composables/useFetchError'

export const useProductsStore = defineStore('products', () => {
  type ProductsResponse = { success: boolean; products: Product[]; count: number }
  // État
  const products = ref<Product[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentEstablishmentId = ref<number | null>(null)

  const {
    selectedEstablishmentId,
    initialize: initializeEstablishments,
  } = useEstablishmentRegister()

  // Actions
  async function loadProducts(establishmentId?: number | null): Promise<void> {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      await initializeEstablishments()

      const targetEstablishmentId = establishmentId ?? selectedEstablishmentId.value ?? undefined
      const response = await $fetch<ProductsResponse>('/api/products', {
        params: targetEstablishmentId ? { establishmentId: targetEstablishmentId } : undefined,
      })

      if (response.success) {
        products.value = response.products
        loaded.value = true
        currentEstablishmentId.value = targetEstablishmentId ?? null
      } else {
        throw new Error('Erreur lors de la récupération des produits')
      }
    } catch (err) {
      console.error('Erreur chargement produits', err)
      error.value = extractFetchError(err)
    } finally {
      loading.value = false
    }
  }

  // Recharger lorsque l'établissement change
  watch(selectedEstablishmentId, (newId, oldId) => {
    if (newId === oldId && loaded.value) return
    loaded.value = false
    loadProducts(newId)
  })

  /**
   * Vérifie si un produit a suffisamment de stock
   * @param productId - ID du produit
   * @param variation - Variation du produit (optionnel)
   * @param quantity - Quantité demandée
   * @returns true si le stock est suffisant
   */
  function hasEnoughStock(
    productId: number,
    variation: string,
    quantity: number
  ): boolean {
    const product = products.value.find(p => p.id === productId)
    if (!product) return false

    let availableStock = 0

    if (variation && product.stockByVariation) {
      availableStock = product.stockByVariation[variation] ?? 0
    } else {
      availableStock = product.stock ?? 0
    }

    return availableStock >= quantity
  }

  /**
   * Récupère le stock disponible pour un produit
   * @param productId - ID du produit
   * @param variation - Variation du produit (optionnel)
   * @returns Le stock disponible
   */
  function getAvailableStock(productId: number, variation: string = ''): number {
    const product = products.value.find(p => p.id === productId)
    if (!product) return 0

    if (variation && product.stockByVariation) {
      return product.stockByVariation[variation] ?? 0
    }
    return product.stock ?? 0
  }

  // Getters
  function getById(id: number): Product | undefined {
    return products.value.find(p => p.id === id)
  }

  /**
   * Récupère les alertes de rupture de stock avec détail par variation
   * Retourne un tableau d'alertes avec le produit et les variations concernées
   */
  const outOfStockAlerts = computed(() => {
    const variationStore = useVariationGroupsStore()
    const alerts: Array<{
      product: Product
      variations?: Array<{ id: string; name: string; stock: number }>
    }> = []

    // Helper function to get variation name by ID
    const getVariationName = (variationId: string): string => {
      for (const group of variationStore.groups) {
        const variation = group.variations.find(v => String(v.id) === variationId)
        if (variation) return variation.name
      }
      return `Variation ${variationId}`
    }

    products.value.forEach(p => {
      if (p.stockByVariation) {
        // Pour les produits avec variations, ne garder que les variations en rupture (stock = 0)
        const outOfStockVariations = Object.entries(p.stockByVariation)
          .filter(([_, stock]) => stock <= 0)
          .map(([id, stock]) => ({ id, name: getVariationName(id), stock }))

        if (outOfStockVariations.length > 0) {
          alerts.push({
            product: p,
            variations: outOfStockVariations
          })
        }
      } else {
        // Pour les produits sans variation
        const stock = p.stock ?? 0
        if (stock <= 0) {
          alerts.push({ product: p })
        }
      }
    })

    return alerts
  })

  /**
   * Récupère tous les produits en rupture de stock
   * Un produit avec variations est en rupture si TOUTES ses variations sont à 0
   * Un produit sans variation est en rupture si son stock est à 0
   */
  const outOfStockProducts = computed(() => {
    return products.value.filter(p => {
      if (p.stockByVariation) {
        // Vérifier que toutes les variations sont en rupture
        return Object.values(p.stockByVariation).every(stock => stock <= 0)
      }
      return (p.stock ?? 0) <= 0
    })
  })

  /**
   * Récupère les alertes de stock faible avec détail par variation
   * Retourne un tableau d'alertes avec le produit et les variations concernées
   */
  const lowStockAlerts = computed(() => {
    const variationStore = useVariationGroupsStore()
    const alerts: Array<{
      product: Product
      variations?: Array<{ id: string; name: string; stock: number }>
    }> = []

    // Helper function to get variation name by ID
    const getVariationName = (variationId: string): string => {
      for (const group of variationStore.groups) {
        const variation = group.variations.find(v => String(v.id) === variationId)
        if (variation) return variation.name
      }
      return `Variation ${variationId}`
    }

    products.value.forEach(p => {
      if (p.stockByVariation) {
        // Pour les produits avec variations, ne garder que les variations en stock faible
        const lowStockVariations = Object.entries(p.stockByVariation)
          .filter(([id, stock]) => {
            const minStockForVariation = p.minStockByVariation?.[id] ?? p.minStock ?? 5
            return stock > 0 && stock <= minStockForVariation
          })
          .map(([id, stock]) => ({ id, name: getVariationName(id), stock }))

        if (lowStockVariations.length > 0) {
          alerts.push({
            product: p,
            variations: lowStockVariations
          })
        }
      } else {
        // Pour les produits sans variation
        const stock = p.stock ?? 0
        const minStock = p.minStock ?? 5
        if (stock > 0 && stock <= minStock) {
          alerts.push({ product: p })
        }
      }
    })

    return alerts
  })

  /**
   * Récupère tous les produits en stock faible (< 5)
   * DEPRECATED: Utilisez lowStockAlerts pour plus de détails
   */
  const lowStockProducts = computed(() => {
    return lowStockAlerts.value.map(alert => alert.product)
  })

  /**
   * Valeur totale du stock
   * Ne compte que les stocks positifs pour ne pas avoir de valeur négative
   */
  const totalStockValue = computed(() => {
    return products.value.reduce((total, p) => {
      let productStock = 0

      if (p.stockByVariation) {
        // Ne compter que les stocks positifs pour la valeur
        productStock = Object.values(p.stockByVariation).reduce((sum, s) => sum + Math.max(0, s), 0)
      } else {
        // Ne compter que les stocks positifs pour la valeur
        productStock = Math.max(0, p.stock ?? 0)
      }

      return total + (productStock * (p.purchasePrice ?? p.price))
    }, 0)
  })

  return {
    // État
    products,
    loaded,
    loading,
    error,
    currentEstablishmentId,

    // Getters
    getById,
    outOfStockProducts,
    outOfStockAlerts,
    lowStockProducts,
    lowStockAlerts,
    totalStockValue,

    // Actions
    loadProducts,
    hasEnoughStock,
    getAvailableStock,
  }
})

