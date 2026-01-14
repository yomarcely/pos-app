import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Product } from '@/types'
import { useVariationGroupsStore } from './variationGroups'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

export const useProductsStore = defineStore('products', () => {
  type ProductsResponse = { success: boolean; products: Product[]; count: number }
  // État
  const products = ref<Product[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentEstablishmentId = ref<number | null>(null)

  // Historique des mouvements de stock pour audit
  const stockHistory = ref<StockMovement[]>([])

  const {
    selectedEstablishmentId,
    initialize: initializeEstablishments,
  } = useEstablishmentRegister()

  // Actions
  async function loadProducts(establishmentId?: number | null) {
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
      error.value = err instanceof Error ? err.message : String(err)
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

  /**
   * Met à jour le stock d'un produit (décrémente lors d'une vente, permet les stocks négatifs)
   * @param productId - ID du produit
   * @param variation - Variation du produit (optionnel)
   * @param quantity - Quantité à déduire
   * @param reason - Raison du mouvement (vente, ajustement, etc.)
   * @param saleId - ID de la vente associée (optionnel)
   */
  function updateStock(
    productId: number,
    variation: string,
    quantity: number,
    reason: StockMovementReason = 'sale',
    saleId?: number
  ): boolean {
    const product = products.value.find(p => p.id === productId)
    if (!product) {
      console.error(`Produit ${productId} non trouvé`)
      return false
    }

    let oldStock = 0
    let newStock = 0

    // Mise à jour du stock selon le type (permet les stocks négatifs)
    if (variation && product.stockByVariation) {
      oldStock = product.stockByVariation[variation] ?? 0
      newStock = oldStock - quantity
      product.stockByVariation[variation] = newStock
    } else if (product.stock !== undefined) {
      oldStock = product.stock
      newStock = oldStock - quantity
      product.stock = newStock
    }

    // Enregistrer le mouvement dans l'historique local (non persisté)
    stockHistory.value.push({
      id: Date.now(),
      productId,
      productName: product.name,
      variation,
      quantity: -quantity, // Négatif car c'est une sortie
      oldStock,
      newStock,
      reason,
      saleId,
      date: new Date(),
      userId: 0 // Historique local uniquement, non persisté en base
    })

    console.log(`✅ Stock mis à jour pour ${product.name}: ${oldStock} → ${newStock}`)
    return true
  }

  /**
   * Ajoute du stock (réception, ajustement)
   * @param productId - ID du produit
   * @param variation - Variation du produit (optionnel)
   * @param quantity - Quantité à ajouter
   * @param reason - Raison du mouvement
   */
  function addStock(
    productId: number,
    variation: string,
    quantity: number,
    reason: StockMovementReason = 'reception'
  ): boolean {
    const product = products.value.find(p => p.id === productId)
    if (!product) {
      console.error(`Produit ${productId} non trouvé`)
      return false
    }

    let oldStock = 0
    let newStock = 0

    if (variation && product.stockByVariation) {
      oldStock = product.stockByVariation[variation] ?? 0
      newStock = oldStock + quantity
      product.stockByVariation[variation] = newStock
    } else if (product.stock !== undefined) {
      oldStock = product.stock
      newStock = oldStock + quantity
      product.stock = newStock
    }

    // Enregistrer le mouvement dans l'historique local (non persisté)
    stockHistory.value.push({
      id: Date.now(),
      productId,
      productName: product.name,
      variation,
      quantity, // Positif car c'est une entrée
      oldStock,
      newStock,
      reason,
      date: new Date(),
      userId: 0 // Historique local uniquement, non persisté en base
    })

    console.log(`✅ Stock ajouté pour ${product.name}: ${oldStock} → ${newStock}`)
    return true
  }

  /**
   * Annule une sortie de stock (en cas d'annulation de vente)
   * @param saleId - ID de la vente à annuler
   */
  function revertStockForSale(saleId: number): boolean {
    // Récupérer tous les mouvements liés à cette vente
    const saleMovements = stockHistory.value.filter(
      m => m.saleId === saleId && m.reason === 'sale'
    )

    if (saleMovements.length === 0) {
      console.warn(`Aucun mouvement de stock trouvé pour la vente ${saleId}`)
      return false
    }

    // Restituer le stock pour chaque produit
    let allSuccess = true
    for (const movement of saleMovements) {
      const product = products.value.find(p => p.id === movement.productId)
      if (!product) {
        allSuccess = false
        continue
      }

      const quantityToRestore = Math.abs(movement.quantity)
      const success = addStock(
        movement.productId,
        movement.variation,
        quantityToRestore,
        'sale_cancellation'
      )

      if (!success) allSuccess = false
    }

    return allSuccess
  }

  /**
   * Définit le stock manuellement (pour ajustements/inventaires)
   * @param productId - ID du produit
   * @param variation - Variation du produit (optionnel)
   * @param newStock - Nouveau stock
   */
  function setStock(
    productId: number,
    variation: string,
    newStock: number
  ): boolean {
    const product = products.value.find(p => p.id === productId)
    if (!product) return false

    let oldStock = 0

    if (variation && product.stockByVariation) {
      oldStock = product.stockByVariation[variation] ?? 0
      product.stockByVariation[variation] = Math.max(0, newStock)
    } else if (product.stock !== undefined) {
      oldStock = product.stock
      product.stock = Math.max(0, newStock)
    }

    const delta = newStock - oldStock

    stockHistory.value.push({
      id: Date.now(),
      productId,
      productName: product.name,
      variation,
      quantity: delta,
      oldStock,
      newStock,
      reason: 'inventory_adjustment',
      date: new Date(),
      userId: 0 // Historique local uniquement, non persisté en base
    })

    return true
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
    stockHistory,

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
    updateStock,
    addStock,
    revertStockForSale,
    setStock
  }
})

// Types pour l'historique des mouvements
export type StockMovementReason = 
  | 'sale'                    // Vente
  | 'sale_cancellation'       // Annulation de vente
  | 'reception'               // Réception fournisseur
  | 'inventory_adjustment'    // Ajustement d'inventaire
  | 'loss'                    // Perte/Casse
  | 'return'                  // Retour client

export interface StockMovement {
  id: number
  productId: number
  productName: string
  variation: string
  quantity: number          // Positif = entrée, Négatif = sortie
  oldStock: number
  newStock: number
  reason: StockMovementReason
  saleId?: number
  date: Date
  userId: number
}
