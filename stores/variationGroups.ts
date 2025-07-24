import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VariationGroup } from '@/types'

export const useVariationGroupsStore = defineStore('variationGroups', () => {
  const groups = ref<VariationGroup[]>([
    {
      id: 'color',
      name: 'Couleur',
      options: [
        { label: 'Noir', value: 'noir' },
        { label: 'Bleu', value: 'bleu' },
        { label: 'Vert', value: 'vert' }
      ]
    },
    {
      id: 'nicotine',
      name: 'Taux de nicotine',
      options: [
        { label: '0mg', value: '0mg' },
        { label: '3mg', value: '3mg' },
        { label: '6mg', value: '6mg' }
      ]
    },
    {
      id: 'resistance',
      name: 'Résistance',
      options: [
        { label: '0.15Ω', value: '0.15' },
        { label: '0.2Ω', value: '0.2' }
      ]
    }
  ])

  return {
    groups
  }
})
