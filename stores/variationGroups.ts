import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VariationGroup } from '@/types'
import { extractFetchError } from '@/composables/useFetchError'

export const useVariationGroupsStore = defineStore('variationGroups', () => {
  const groups = ref<VariationGroup[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadGroups(): Promise<void> {
    if (loaded.value) return
    loading.value = true
    error.value = null
    try {
      const response = await $fetch<{ success: boolean; groups: VariationGroup[] }>('/api/variations')
      groups.value = response.groups ?? []
      loaded.value = true
    } catch (err) {
      error.value = extractFetchError(err)
    } finally {
      loading.value = false
    }
  }

  function invalidate() {
    loaded.value = false
  }

  /**
   * Résout un nom de variation vers son ID parmi les variations d'un produit
   * (product.variationGroupIds contient des IDs de variations, pas de groupes).
   * Les noms peuvent être purement numériques (ex. taille « 38 ») : la
   * résolution se fait toujours par nom, jamais en interprétant le nom comme
   * un ID. Retourne null si le nom ne correspond à aucune variation du produit.
   */
  function resolveVariationId(
    productVariationIds: Array<number | string> | undefined | null,
    name: string | null | undefined
  ): number | null {
    if (!name || !Array.isArray(productVariationIds) || productVariationIds.length === 0) return null
    const idSet = new Set(productVariationIds.map(Number))
    for (const group of groups.value) {
      const variation = group.variations.find(v => idSet.has(Number(v.id)) && v.name === name)
      if (variation) return Number(variation.id)
    }
    return null
  }

  return {
    groups,
    loaded,
    loading,
    error,
    loadGroups,
    invalidate,
    resolveVariationId,
  }
})
