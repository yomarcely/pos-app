// stores/sellers.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Seller } from '@/types'

const STORAGE_KEY = 'pos_selected_seller'

export const useSellersStore = defineStore('sellers', () => {
  const sellers = ref<Seller[]>([])
  const selectedSeller = ref<string | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadSellers(establishmentId?: number) {
    // Si on filtre par établissement, on recharge toujours
    if (!establishmentId && (loaded.value || loading.value)) return

    loading.value = true
    error.value = null
    try {
      const params = establishmentId ? { establishmentId } : {}
      const response = await $fetch('/api/sellers', { params })
      sellers.value = response.sellers || []

      // On marque comme chargé seulement si c'est un chargement complet (sans filtre)
      if (!establishmentId) {
        loaded.value = true
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  function selectSellerById(id: number | string | null) {
    selectedSeller.value = id ? String(id) : null
  }

  function hydrateSelectedSeller() {
    if (!process.client) return
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (savedId) {
      selectedSeller.value = savedId
    }
  }

  function ensureValidSelectedSeller() {
    if (!sellers.value.length) {
      selectedSeller.value = null
      return
    }

    if (selectedSeller.value && sellers.value.some(s => s.id === Number(selectedSeller.value))) {
      return
    }

    const firstSeller = sellers.value[0]
    selectedSeller.value = firstSeller ? String(firstSeller.id) : null
  }

  async function initialize(establishmentId?: number) {
    hydrateSelectedSeller()
    await loadSellers(establishmentId)
    ensureValidSelectedSeller()
  }

  function clearSeller() {
    selectedSeller.value = null
  }

  watch(selectedSeller, (value) => {
    if (!process.client) return
    if (value) {
      localStorage.setItem(STORAGE_KEY, value)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  })

  return {
    sellers,
    selectedSeller,
    loaded,
    loading,
    error,
    initialize,
    loadSellers,
    selectSellerById,
    clearSeller
  }
})
