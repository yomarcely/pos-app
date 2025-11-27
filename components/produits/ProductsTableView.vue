<template>
  <Card>
    <CardContent class="p-0">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50 border-b">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Produit
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Code-barres
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Catégorie
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Prix TTC
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Stock
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr
              v-for="product in products"
              :key="product.id"
              class="hover:bg-muted/50 transition-colors cursor-pointer"
              @click="$emit('edit', product)"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                  <div v-if="product.image" class="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img :src="product.image" :alt="product.name" class="w-full h-full object-cover" />
                  </div>
                  <div v-else class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Package class="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div class="font-medium">{{ product.name }}</div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {{ product.barcode || '-' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span v-if="product.categoryName" class="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                  {{ product.categoryName }}
                </span>
                <span v-else class="text-sm text-muted-foreground">-</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap font-medium">
                {{ formatPrice(product.price) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="px-2 py-1 text-xs rounded-full font-medium"
                  :class="getStockBadgeClass(getTotalStock(product))"
                >
                  {{ getTotalStock(product) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2" @click.stop>
                  <Button variant="ghost" size="sm" @click="$emit('view', product)">
                    <Eye class="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" @click="$emit('edit', product)">
                    <Edit class="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" @click="$emit('delete', product)">
                    <Trash2 class="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Package, Eye, Edit, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Product } from '@/types/produits'

defineProps<{
  products: Product[]
}>()

defineEmits<{
  view: [product: Product]
  edit: [product: Product]
  delete: [product: Product]
}>()

function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price)
}

function getStockBadgeClass(stock: number): string {
  if (stock === 0) return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
  if (stock < 10) return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
  return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
}

function getTotalStock(product: Product): number {
  if (product.stockByVariation && Object.keys(product.stockByVariation).length > 0) {
    return Object.values(product.stockByVariation).reduce((sum, qty) => sum + qty, 0)
  }
  return product.stock || 0
}
</script>
