<template>
  <Card v-if="lines.size > 0">
    <CardHeader>
      <CardTitle>Articles à inventorier ({{ lines.size }})</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 border-b">
            <tr>
              <th class="px-4 py-2 text-left">Produit</th>
              <th class="px-4 py-2 text-left">Variation</th>
              <th class="px-4 py-2 text-center">Stock actuel</th>
              <th class="px-4 py-2 text-center">Stock compté</th>
              <th class="px-4 py-2 text-center">Écart</th>
              <th class="px-4 py-2 text-center w-16">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="[key, line] in linesArray" :key="key" class="hover:bg-muted/50">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div v-if="line.productImage" class="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                    <img :src="line.productImage" :alt="line.productName" class="w-full h-full object-cover" />
                  </div>
                  <div v-else class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package class="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span class="font-medium">{{ line.productName }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {{ line.variationName || '—' }}
              </td>
              <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 rounded-full text-xs font-medium bg-muted">
                  {{ line.currentStock }}
                </span>
              </td>
              <td class="px-4 py-3">
                <Input
                  :model-value="line.countedStock"
                  type="number"
                  min="0"
                  class="w-24 mx-auto text-center"
                  @update:model-value="(v) => $emit('updateCountedStock', key, parseInt(v as string) || 0)"
                />
              </td>
              <td
                class="px-4 py-3 text-center font-medium"
                :class="diffClass(line)"
              >
                {{ diffLabel(line) }}
              </td>
              <td class="px-4 py-3 text-center">
                <Button variant="ghost" size="sm" @click="$emit('removeLine', key)">
                  <Trash2 class="w-4 h-4 text-destructive" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <Button variant="outline" @click="$emit('clearAll')">
          Tout annuler
        </Button>
        <Button @click="$emit('validate')" :disabled="lines.size === 0">
          Valider la préparation
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Package, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { InventoryPreparationLine } from '@/composables/useInventoryPreparation'

const props = defineProps<{
  lines: Map<string, InventoryPreparationLine>
}>()

defineEmits<{
  'updateCountedStock': [key: string, value: number]
  'removeLine': [key: string]
  'clearAll': []
  'validate': []
}>()

const linesArray = computed(() => Array.from(props.lines.entries()))

function diff(line: InventoryPreparationLine): number {
  return Number(line.countedStock) - Number(line.currentStock)
}

function diffLabel(line: InventoryPreparationLine): string {
  const d = diff(line)
  if (d === 0) return '0'
  return d > 0 ? `+${d}` : `${d}`
}

function diffClass(line: InventoryPreparationLine): string {
  const d = diff(line)
  if (d === 0) return 'text-muted-foreground'
  return d > 0 ? 'text-green-600' : 'text-red-600'
}
</script>
