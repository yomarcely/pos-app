// stores/sellers.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Seller } from '@/types'
import { extractFetchError } from '@/composables/useFetchError'
import { useAuthStore } from '@/stores/auth'

const STORAGE_KEY_PREFIX = 'pos_selected_seller'

function scopedKey(tenantId: string | null): string | null {
  return tenantId ? `${STORAGE_KEY_PREFIX}_${tenantId}` : null
}

// Migration one-shot : retire l'ancienne clé non-scopée — sinon User A et
// User B sur le même navigateur héritaient de la sélection l'un de l'autre.
function cleanupLegacyKey(): void {
  if (!process.client) return
  localStorage.removeItem(STORAGE_KEY_PREFIX)
}

export const useSellersStore = defineStore('sellers', () => {
  const sellers = ref<Seller[]>([])
  const selectedSeller = ref<string | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadSellers(establishmentId?: number): Promise<void> {
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
      error.value = extractFetchError(err)
    } finally {
      loading.value = false
    }
  }

  function selectSellerById(id: number | string | null): void {
    selectedSeller.value = id ? String(id) : null
  }

  function hydrateSelectedSeller(): void {
    if (!process.client) return
    const key = scopedKey(useAuthStore().tenantId)
    if (!key) return // pas de tenant → ne rien lire (évite fuite cross-tenant)
    const savedId = localStorage.getItem(key)
    if (savedId) {
      selectedSeller.value = savedId
    }
  }

  function ensureValidSelectedSeller(): void {
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

  async function initialize(establishmentId?: number): Promise<void> {
    cleanupLegacyKey()
    hydrateSelectedSeller()
    await loadSellers(establishmentId)
    ensureValidSelectedSeller()
  }

  function clearSeller(): void {
    selectedSeller.value = null
  }

  watch(selectedSeller, (value) => {
    if (!process.client) return
    const key = scopedKey(useAuthStore().tenantId)
    if (!key) return // fail-closed : pas de tenant → ne rien écrire
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
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
