<template>
  <Card>
    <CardHeader>
      <CardTitle>Gestion du stock</CardTitle>
      <CardDescription>Définissez le stock initial et le seuil d'alerte</CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <div v-if="!hasVariations">
        <!-- Stock initial simple -->
        <div class="space-y-2">
          <Label for="initial-stock">Stock initial</Label>
          <Input
            id="initial-stock"
            type="number"
            min="0"
            placeholder="0"
            :model-value="initialStock"
            @update:model-value="$emit('update:initialStock', parseInt($event as string) || 0)"
          />
          <p class="text-xs text-muted-foreground">
            Quantité en stock lors de la création du produit
          </p>
        </div>

        <!-- Stock minimum -->
        <div class="space-y-2">
          <Label for="min-stock">Stock minimum (alerte)</Label>
          <Input
            id="min-stock"
            type="number"
            min="0"
            placeholder="5"
            :model-value="minStock"
            @update:model-value="$emit('update:minStock', parseInt($event as string) || 0)"
          />
          <p class="text-xs text-muted-foreground">
            Vous serez alerté lorsque le stock descendra en dessous de ce seuil
          </p>
        </div>
      </div>

      <div v-else>
        <!-- Stock par variation -->
        <div v-if="selectedVariationsList.length === 0" class="text-center py-8 text-muted-foreground">
          <Info class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune variation sélectionnée.</p>
          <p class="text-sm">Sélectionnez des variations dans l'onglet "Variations".</p>
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-muted-foreground">
            Définissez le stock initial et le seuil d'alerte pour chaque variation
          </p>
          <div v-for="variation in selectedVariationsList" :key="variation.id" class="border rounded-lg p-4 space-y-3">
            <h4 class="font-medium">{{ variation.name }}</h4>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label :for="`stock-${variation.id}`">Stock initial</Label>
                <Input
                  :id="`stock-${variation.id}`"
                  type="number"
                  min="0"
                  placeholder="0"
                  :model-value="initialStockByVariation[variation.id] || 0"
                  @update:model-value="updateStockByVariation(variation.id, parseInt($event as string) || 0)"
                />
              </div>
              <div class="space-y-2">
                <Label :for="`min-stock-${variation.id}`">Stock minimum</Label>
                <Input
                  :id="`min-stock-${variation.id}`"
                  type="number"
                  min="0"
                  placeholder="5"
                  :model-value="minStockByVariation[variation.id] || 0"
                  @update:model-value="updateMinStockByVariation(variation.id, parseInt($event as string) || 0)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Info } from 'lucide-vue-next'

interface Variation {
  id: number
  name: string
}

const props = defineProps<{
  hasVariations: boolean
  initialStock: number
  minStock: number
  initialStockByVariation: Record<number, number>
  minStockByVariation: Record<number, number>
  selectedVariationsList: Variation[]
}>()

const emit = defineEmits<{
  'update:initialStock': [value: number]
  'update:minStock': [value: number]
  'update:initialStockByVariation': [value: Record<number, number>]
  'update:minStockByVariation': [value: Record<number, number>]
}>()

function updateStockByVariation(variationId: number, value: number) {
  const updated = { ...props.initialStockByVariation, [variationId]: value }
  emit('update:initialStockByVariation', updated)
}

function updateMinStockByVariation(variationId: number, value: number) {
  const updated = { ...props.minStockByVariation, [variationId]: value }
  emit('update:minStockByVariation', updated)
}
</script>
