<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, computed, onMounted } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useVariationGroupsStore } from '@/stores/variationGroups'
import type { Product } from '@/types'
import PageHeader from '@/components/common/PageHeader.vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, TrendingUp, AlertCircle, PackageX, ChevronDown, ChevronRight } from 'lucide-vue-next'

const productsStore = useProductsStore()
const variationGroupsStore = useVariationGroupsStore()

onMounted(() => {
  productsStore.loadProducts()
  variationGroupsStore.loadGroups()
})

// Fonction pour obtenir le nom d'une variation par son ID
function getVariationNameById(variationId: number): string {
  for (const group of variationGroupsStore.groups) {
    const variation = group.variations.find(v => v.id === variationId)
    if (variation) {
      return variation.name
    }
  }
  return `Variation ${variationId}`
}

// Filtres
const searchQuery = ref('')
const stockFilter = ref<'all' | 'low' | 'out'>('all')

// Produit avec variations déployées
const expandedProducts = ref<Set<number>>(new Set())

function toggleProductExpansion(productId: number) {
  if (expandedProducts.value.has(productId)) {
    expandedProducts.value.delete(productId)
  } else {
    expandedProducts.value.add(productId)
  }
}

// Compter le nombre total de variations en stock faible
const lowStockVariationsCount = computed(() => {
  let count = 0
  productsStore.lowStockAlerts.forEach(alert => {
    if (alert.variations && alert.variations.length > 0) {
      count += alert.variations.length
    } else {
      count += 1
    }
  })
  return count
})

// Compter le nombre total de variations en rupture
const outOfStockVariationsCount = computed(() => {
  let count = 0
  productsStore.outOfStockAlerts.forEach(alert => {
    if (alert.variations && alert.variations.length > 0) {
      count += alert.variations.length
    } else {
      count += 1
    }
  })
  return count
})

const filteredProducts = computed(() => {
  let filtered = productsStore.products

  // Filtre de recherche
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.barcode?.toLowerCase().includes(query)
    )
  }

  // Filtre de stock
  if (stockFilter.value === 'low') {
    const lowStockProductIds = new Set(productsStore.lowStockAlerts.map(a => a.product.id))
    filtered = filtered.filter(p => lowStockProductIds.has(p.id))
  } else if (stockFilter.value === 'out') {
    const outOfStockProductIds = new Set(productsStore.outOfStockAlerts.map(a => a.product.id))
    filtered = filtered.filter(p => outOfStockProductIds.has(p.id))
  }

  return filtered
})

// Déterminer si une variation est en stock faible
function isVariationLowStock(product: Product, variationId: number): boolean {
  const alert = productsStore.lowStockAlerts.find(a => a.product.id === product.id)
  if (!alert) return false
  return alert.variations?.some((v: any) => v.variationId === variationId) ?? false
}

// Déterminer si une variation est en rupture
function isVariationOutOfStock(product: Product, variationId: number): boolean {
  const alert = productsStore.outOfStockAlerts.find(a => a.product.id === product.id)
  if (!alert) return false
  return alert.variations?.some((v: any) => v.variationId === variationId) ?? false
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- En-tête -->
    <PageHeader
      title="État des stocks"
      description="Visualisez et consultez vos niveaux de stock"
    />

      <!-- Statistiques -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-card p-4 rounded-lg border">
          <div class="flex items-center gap-2">
            <Package class="h-5 w-5 text-muted-foreground" />
            <span class="text-sm font-medium text-muted-foreground">Total produits</span>
          </div>
          <p class="text-2xl font-bold mt-2">{{ productsStore.products.length }}</p>
        </div>

        <div class="bg-card p-4 rounded-lg border">
          <div class="flex items-center gap-2">
            <TrendingUp class="h-5 w-5 text-green-600" />
            <span class="text-sm font-medium text-muted-foreground">Valeur stock</span>
          </div>
          <p class="text-2xl font-bold mt-2">{{ productsStore.totalStockValue.toFixed(2) }} €</p>
        </div>

        <div class="bg-card p-4 rounded-lg border">
          <div class="flex items-center gap-2">
            <AlertCircle class="h-5 w-5 text-orange-600" />
            <span class="text-sm font-medium text-muted-foreground">Stock faible</span>
          </div>
          <p class="text-2xl font-bold mt-2 text-orange-600">{{ lowStockVariationsCount }}</p>
        </div>

        <div class="bg-card p-4 rounded-lg border">
          <div class="flex items-center gap-2">
            <PackageX class="h-5 w-5 text-red-600" />
            <span class="text-sm font-medium text-muted-foreground">Rupture</span>
          </div>
          <p class="text-2xl font-bold mt-2 text-red-600">{{ outOfStockVariationsCount }}</p>
        </div>
      </div>

      <!-- Filtres -->
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1">
          <Input
            v-model="searchQuery"
            placeholder="Rechercher un produit (nom, code-barres)..."
            class="max-w-md"
          />
        </div>

        <div class="flex gap-2">
          <Button
            :variant="stockFilter === 'all' ? 'default' : 'outline'"
            @click="stockFilter = 'all'"
          >
            Tous
          </Button>
          <Button
            :variant="stockFilter === 'low' ? 'default' : 'outline'"
            @click="stockFilter = 'low'"
          >
            Stock faible
          </Button>
          <Button
            :variant="stockFilter === 'out' ? 'default' : 'outline'"
            @click="stockFilter = 'out'"
          >
            Rupture
          </Button>
        </div>
      </div>

    <!-- Tableau des stocks -->
    <div class="border rounded-lg">
      <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-12"></TableHead>
              <TableHead>Produit</TableHead>
              <TableHead class="text-center">Stock</TableHead>
              <TableHead class="text-right">Prix d'achat</TableHead>
              <TableHead class="text-right">Valeur stock</TableHead>
              <TableHead class="text-center">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="product in filteredProducts" :key="product.id">
              <!-- Ligne principale du produit -->
              <TableRow>
                <TableCell>
                  <Button
                    v-if="product.variationGroupIds?.length"
                    variant="ghost"
                    size="sm"
                    @click="toggleProductExpansion(product.id)"
                  >
                    <ChevronRight
                      v-if="!expandedProducts.has(product.id)"
                      class="h-4 w-4"
                    />
                    <ChevronDown v-else class="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-3">
                    <div v-if="product.image" class="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                      <img :src="product.image" :alt="product.name" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Package class="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p class="font-medium">{{ product.name }}</p>
                      <p v-if="product.barcode" class="text-xs text-muted-foreground">{{ product.barcode }}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell class="text-center">
                  <Badge variant="secondary">
                    {{ product.stock || 0 }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  {{ product.purchasePrice ? `${product.purchasePrice.toFixed(2)} €` : '-' }}
                </TableCell>
                <TableCell class="text-right font-medium">
                  {{ ((product.stock || 0) * (product.purchasePrice || product.price || 0)).toFixed(2) }} €
                </TableCell>
                <TableCell class="text-center">
                  <Badge
                    v-if="(product.stock ?? 0) === 0"
                    variant="destructive"
                  >
                    Rupture
                  </Badge>
                  <Badge
                    v-else-if="product.minStock && (product.stock ?? 0) <= product.minStock"
                    class="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    Stock faible
                  </Badge>
                  <Badge v-else variant="outline" class="text-green-600 border-green-600">
                    En stock
                  </Badge>
                </TableCell>
              </TableRow>

              <!-- Lignes des variations (si déployé) -->
              <template v-if="expandedProducts.has(product.id) && product.variationGroupIds?.length">
                <TableRow
                  v-for="(stock, varId) in product.stockByVariation"
                  :key="`${product.id}-${varId}`"
                  class="bg-muted/30"
                >
                  <TableCell></TableCell>
                  <TableCell class="pl-12">
                    <span class="text-sm text-muted-foreground">
                      {{ getVariationNameById(parseInt(varId)) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-center">
                    <Badge variant="secondary">{{ stock }}</Badge>
                  </TableCell>
                  <TableCell class="text-right">
                    {{ product.purchasePrice ? `${product.purchasePrice.toFixed(2)} €` : '-' }}
                  </TableCell>
                  <TableCell class="text-right font-medium">
                    {{ (stock * (product.purchasePrice || product.price || 0)).toFixed(2) }} €
                  </TableCell>
                  <TableCell class="text-center">
                    <Badge
                      v-if="stock === 0 || isVariationOutOfStock(product, parseInt(varId))"
                      variant="destructive"
                    >
                      Rupture
                    </Badge>
                    <Badge
                      v-else-if="product.minStock && stock <= product.minStock || isVariationLowStock(product, parseInt(varId))"
                      class="bg-orange-600 text-white hover:bg-orange-700"
                    >
                      Stock faible
                    </Badge>
                    <Badge v-else variant="outline" class="text-green-600 border-green-600">
                      En stock
                    </Badge>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </template>
            </template>
          </TableBody>
        </Table>
      </div>
  </div>
</template>
