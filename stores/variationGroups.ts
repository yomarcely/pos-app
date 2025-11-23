import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VariationGroup } from '@/types'

export const useVariationGroupsStore = defineStore('variationGroups', () => {
  const groups = ref<VariationGroup[]>([])
  const loaded = ref(false)

  async function loadGroups() {
    if (loaded.value) return

    try {
      const response = await $fetch('/api/variations')
      groups.value = response.groups || []
      loaded.value = true
    } catch (error) {
      console.error('Erreur lors du chargement des groupes de variations:', error)
    }
  }

  return {
    groups,
    loadGroups
  }
})
