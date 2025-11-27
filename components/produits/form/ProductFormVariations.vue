<template>
  <Card>
    <CardHeader>
      <CardTitle>Variations du produit</CardTitle>
      <CardDescription>Sélectionnez les variations disponibles pour ce produit</CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <div v-if="!hasVariations" class="text-center py-8 text-muted-foreground">
        <Info class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Les variations sont désactivées pour ce produit.</p>
        <p class="text-sm">Activez-les dans l'onglet "Général" pour les configurer.</p>
      </div>

      <div v-else class="space-y-6">
        <div v-if="variationGroups.length === 0" class="text-center py-8 text-muted-foreground">
          <Layers class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun groupe de variation disponible.</p>
          <p class="text-sm">Créez d'abord des groupes de variations dans la page dédiée.</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Menu déroulant pour sélectionner le groupe -->
          <div class="space-y-2">
            <Label for="variation-group-select">Groupe de variation</Label>
            <select
              id="variation-group-select"
              :value="selectedGroupId"
              class="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              @change="$emit('update:selectedGroupId', parseInt(($event.target as HTMLSelectElement).value))"
            >
              <option :value="null">Sélectionnez un groupe</option>
              <option v-for="group in variationGroups" :key="group.id" :value="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>

          <!-- Afficher les variations du groupe sélectionné -->
          <div v-if="selectedGroup" class="space-y-3">
            <Label class="font-semibold">Variations disponibles</Label>
            <div class="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
              <div
                v-for="variation in selectedGroup.variations"
                :key="variation.id"
                class="flex items-center space-x-2"
              >
                <Checkbox
                  :id="`variation-${variation.id}`"
                  :checked="isVariationSelected(variation.id)"
                  @update:checked="toggleVariation(variation.id, $event)"
                />
                <Label
                  :for="`variation-${variation.id}`"
                  class="text-sm font-normal cursor-pointer"
                >
                  {{ variation.name }}
                </Label>
              </div>
            </div>
          </div>

          <!-- Récapitulatif des variations sélectionnées -->
          <div v-if="selectedVariationsIds.length > 0" class="p-4 bg-muted rounded-lg">
            <p class="text-sm font-medium mb-2">Variations sélectionnées :</p>
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="id in selectedVariationsIds"
                :key="id"
                variant="secondary"
                class="gap-1"
              >
                {{ getVariationName(id) }}
                <X
                  class="w-3 h-3 cursor-pointer hover:text-destructive"
                  @click="toggleVariation(id, false)"
                />
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Info, Layers, X } from 'lucide-vue-next'

interface Variation {
  id: number
  name: string
}

interface VariationGroup {
  id: number
  name: string
  variations: Variation[]
}

const props = defineProps<{
  hasVariations: boolean
  variationGroups: VariationGroup[]
  selectedGroupId: number | null
  selectedVariationsIds: number[]
}>()

const emit = defineEmits<{
  'update:selectedGroupId': [value: number | null]
  'update:selectedVariationsIds': [value: number[]]
}>()

const selectedGroup = computed(() => {
  if (!props.selectedGroupId) return null
  return props.variationGroups.find(g => g.id === props.selectedGroupId) || null
})

function isVariationSelected(variationId: number): boolean {
  return props.selectedVariationsIds.includes(variationId)
}

function toggleVariation(variationId: number, checked: boolean) {
  let newIds = [...props.selectedVariationsIds]
  if (checked) {
    if (!newIds.includes(variationId)) {
      newIds.push(variationId)
    }
  } else {
    newIds = newIds.filter(id => id !== variationId)
  }
  emit('update:selectedVariationsIds', newIds)
}

function getVariationName(variationId: number): string {
  for (const group of props.variationGroups) {
    const variation = group.variations.find(v => v.id === variationId)
    if (variation) return variation.name
  }
  return `Variation ${variationId}`
}
</script>
