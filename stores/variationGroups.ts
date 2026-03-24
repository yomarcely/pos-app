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

  return {
    groups,
    loaded,
    loading,
    error,
    loadGroups,
    invalidate,
  }
})
