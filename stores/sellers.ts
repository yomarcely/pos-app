// stores/sellers.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Seller } from '@/types'

export const useSellersStore = defineStore('sellers', () => {
  const sellers = ref<Seller[]>([])
  const selectedSeller = ref<Seller | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadSellers() {
    if (loaded.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/mock/sellers.json')
      sellers.value = await res.json()
      loaded.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

function selectSellerById(id: number) {
  selectedSeller.value = sellers.value.find(s => s.id === id) ?? null
}

  function clearSeller() {
    selectedSeller.value = null
  }

  return {
    sellers,
    selectedSeller,
    loaded,
    loading,
    error,
    loadSellers,
    selectSellerById,
    clearSeller
  }
})
