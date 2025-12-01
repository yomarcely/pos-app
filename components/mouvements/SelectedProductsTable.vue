<template>
  <Card v-if="selectedProducts.length > 0">
    <CardHeader>
      <CardTitle>Produits sélectionnés ({{ selectedProducts.length }})</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50 border-b">
            <tr>
              <th class="px-4 py-2 text-left text-sm font-medium">Produit</th>
              <th class="px-4 py-2 text-center text-sm font-medium">Stock actuel</th>
              <th class="px-4 py-2 text-center text-sm font-medium">
                {{ movementType === 'entry' ? 'Quantité' : movementType === 'adjustment' ? 'Nouveau stock' : 'Perte' }}
              </th>
              <th class="px-4 py-2 text-center text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <template v-for="item in selectedProducts" :key="item.product.id">
              <!-- Produit sans variation -->
              <tr v-if="!hasVariations(item.product)" class="hover:bg-muted/50">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div v-if="item.product.image" class="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                      <img :src="item.product.image" :alt="item.product.name" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Package class="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p class="font-medium">{{ item.product.name }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="px-2 py-1 rounded-full text-xs font-medium bg-muted">
                    {{ item.currentStock }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <Input
                    :model-value="item.quantity"
                    type="number"
                    :min="movementType === 'loss' ? 1 : undefined"
                    class="w-24 mx-auto text-center"
                    @update:model-value="$emit('updateQuantity', item.product.id, null, parseInt($event as string) || 0)"
                  />
                </td>
                <td class="px-4 py-3 text-center">
                  <Button variant="ghost" size="sm" @click="$emit('removeProduct', item.product.id)">
                    <Trash2 class="w-4 h-4 text-destructive" />
                  </Button>
                </td>
              </tr>

              <!-- Produit avec variations -->
              <template v-else>
                <!-- Ligne principale du produit -->
                <tr class="bg-muted/30">
                  <td class="px-4 py-3" colspan="3">
                    <div class="flex items-center gap-3">
                      <div v-if="item.product.image" class="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                        <img :src="item.product.image" :alt="item.product.name" class="w-full h-full object-cover" />
                      </div>
                      <div v-else class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package class="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p class="font-medium">{{ item.product.name }}</p>
                        <p class="text-xs text-muted-foreground">Produit avec variations</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" @click="$emit('removeProduct', item.product.id)">
                      <Trash2 class="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>

                <!-- Lignes des variations -->
                <tr
                  v-for="variation in getProductVariations(item.product)"
                  :key="`${item.product.id}-${variation.id}`"
                  class="hover:bg-muted/50"
                >
                  <td class="px-4 py-3 pl-16">
                    <p class="text-sm">{{ variation.name }}</p>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span class="px-2 py-1 rounded-full text-xs font-medium bg-muted">
                      {{ item.product.stockByVariation?.[variation.id.toString()] ?? 0 }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <Input
                      :model-value="item.quantitiesByVariation?.[variation.id.toString()] ?? 0"
                      type="number"
                      :min="movementType === 'loss' ? 1 : undefined"
                      class="w-24 mx-auto text-center"
                      @update:model-value="$emit('updateQuantity', item.product.id, variation.id.toString(), parseInt($event as string) || 0)"
                    />
                  </td>
                  <td class="px-4 py-3 text-center">
                    <!-- Espace vide pour aligner avec le bouton supprimer du produit -->
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Boutons d'action -->
      <div class="flex justify-end gap-2 mt-4">
        <Button variant="outline" @click="$emit('clearAll')">
          Annuler
        </Button>
        <Button @click="$emit('validate')" :disabled="selectedProducts.length === 0">
          Valider le mouvement
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Package, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { SelectedProduct, Variation, MovementType } from '@/types/mouvements'

const props = defineProps<{
  selectedProducts: SelectedProduct[]
  movementType: MovementType
  allVariations: Variation[]
}>()

defineEmits<{
  'updateQuantity': [productId: number, variationId: string | null, quantity: number]
  'removeProduct': [productId: number]
  'clearAll': []
  'validate': []
}>()

function hasVariations(product: any): boolean {
  return !!(
    (product.variationGroupIds && product.variationGroupIds.length > 0) ||
    (product.stockByVariation && Object.keys(product.stockByVariation).length > 0)
  )
}

function getProductVariations(product: any): Variation[] {
  const idsFromProduct = Array.isArray(product.variationGroupIds)
    ? product.variationGroupIds.map((id: any) => {
        const numericId = Number(id)
        return Number.isFinite(numericId) ? numericId : String(id)
      })
    : []

  const idsFromStock = product.stockByVariation
    ? Object.keys(product.stockByVariation).map((id) => {
        const numericId = Number(id)
        return Number.isFinite(numericId) ? numericId : id
      })
    : []

  const variationIds = idsFromProduct.length ? idsFromProduct : idsFromStock
  const uniqueIds = Array.from(new Set(variationIds))

  return uniqueIds.map((id) => {
    const numericId = typeof id === 'number' ? id : Number(id)
    const found = Number.isFinite(numericId)
      ? props.allVariations.find((v) => v.id === numericId)
      : undefined

    return found || { id: id as string | number, name: `Variation ${id}` }
  })
}
</script>
