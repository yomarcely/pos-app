import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Product } from '@/types'

export const useProductsStore = defineStore('products', () => {
  // État
  const products = ref<Product[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions
  async function loadProducts() {
    if (loaded.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/mock/products.json')
      products.value = await res.json()
      loaded.value = true
    } catch (err) {
      console.error('Erreur chargement produits', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  // Getters
  function getById(id: number): Product | undefined {
    return products.value.find(p => p.id === id)
  }

  return { products, loaded, loading, error, loadProducts, getById }
})
