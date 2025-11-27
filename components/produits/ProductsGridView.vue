<template>
  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
    <Card
      v-for="product in products"
      :key="product.id"
      class="hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
      @click="$emit('edit', product)"
    >
      <CardContent class="p-0">
        <!-- Image -->
        <div class="relative aspect-square bg-muted">
          <img
            v-if="product.image"
            :src="product.image"
            :alt="product.name"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Package class="w-8 h-8 text-muted-foreground" />
          </div>

          <!-- Badge stock -->
          <div class="absolute top-1 right-1">
            <span
              class="px-1.5 py-0.5 text-xs rounded-full font-medium"
              :class="getStockBadgeClass(getTotalStock(product))"
            >
              {{ getTotalStock(product) }}
            </span>
          </div>

          <!-- Badge catégorie -->
          <div v-if="product.categoryName" class="absolute top-1 left-1">
            <span class="px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
              {{ product.categoryName }}
            </span>
          </div>
        </div>

        <!-- Infos -->
        <div class="p-2">
          <h3 class="font-medium text-sm mb-1 truncate">{{ product.name }}</h3>
          <p v-if="product.barcode" class="text-xs text-muted-foreground mb-1 truncate">{{ product.barcode }}</p>
          <div class="flex items-center justify-between">
            <div class="text-sm font-bold">
              {{ formatPrice(product.price) }}
            </div>
            <div class="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6"
                @click.stop="$emit('edit', product)"
              >
                <Edit class="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6"
                @click.stop="$emit('delete', product)"
              >
                <Trash2 class="w-3 h-3 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Package, Edit, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Product } from '@/types/produits'

defineProps<{
  products: Product[]
}>()

defineEmits<{
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
