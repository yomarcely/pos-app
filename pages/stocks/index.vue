<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, computed, onMounted } from 'vue'
import { useProductsStore } from '@/stores/products'
import type { Product } from '@/types'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Package, TrendingUp, AlertCircle, PackageX, History } from 'lucide-vue-next'

const productsStore = useProductsStore()

onMounted(() => {
  productsStore.loadProducts()
})

// Computed pour obtenir les variations disponibles du produit sélectionné
const availableVariations = computed(() => {
  if (!selectedProduct.value?.stockByVariation) return []
  return Object.keys(selectedProduct.value.stockByVariation)
})

// Computed pour obtenir le stock actuel (global ou par variation)
const currentStock = computed(() => {
  if (!selectedProduct.value) return 0

  if (selectedVariation.value && selectedProduct.value.stockByVariation) {
    return selectedProduct.value.stockByVariation[selectedVariation.value] ?? 0
  }

  if (selectedProduct.value.stockByVariation) {
    // Si pas de variation sélectionnée, afficher le total
    return Object.values(selectedProduct.value.stockByVariation).reduce((sum, s) => sum + s, 0)
  }

  return selectedProduct.value.stock ?? 0
})

// Filtres
const searchQuery = ref('')
const stockFilter = ref<'all' | 'low' | 'out'>('all')

// Produit sélectionné pour ajustement
const selectedProduct = ref<Product | null>(null)
const adjustmentQuantity = ref(0)
const adjustmentType = ref<'add' | 'set'>('add')
const isAdjustDialogOpen = ref(false)
const selectedVariation = ref('')

// Historique
const isHistoryDialogOpen = ref(false)

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
    // Produits avec au moins une variation en stock faible
    const lowStockProductIds = new Set(productsStore.lowStockAlerts.map(a => a.product.id))
    filtered = filtered.filter(p => lowStockProductIds.has(p.id))
  } else if (stockFilter.value === 'out') {
    // Produits avec au moins une variation en rupture
    const outOfStockProductIds = new Set(productsStore.outOfStockAlerts.map(a => a.product.id))
    filtered = filtered.filter(p => outOfStockProductIds.has(p.id))
  }

  return filtered
})

function openAdjustDialog(product: Product) {
  selectedProduct.value = product
  adjustmentQuantity.value = 0
  adjustmentType.value = 'add'
  selectedVariation.value = ''
  isAdjustDialogOpen.value = true
}

function applyAdjustment() {
  if (!selectedProduct.value) return

  const product = selectedProduct.value

  if (adjustmentType.value === 'add') {
    productsStore.addStock(
      product.id,
      selectedVariation.value,
      adjustmentQuantity.value,
      'inventory_adjustment'
    )
  } else {
    productsStore.setStock(
      product.id,
      selectedVariation.value,
      adjustmentQuantity.value
    )
  }

  isAdjustDialogOpen.value = false
  selectedProduct.value = null
}

function getStockBadge(product: Product) {
  let totalStock = 0
  
  if (product.stockByVariation) {
    totalStock = Object.values(product.stockByVariation).reduce((sum, s) => sum + s, 0)
  } else {
    totalStock = product.stock ?? 0
  }

  if (totalStock === 0) {
    return { variant: 'destructive' as const, label: 'Rupture' }
  } else if (totalStock < 5) {
    return { variant: 'secondary' as const, label: `Stock faible (${totalStock})` }
  } else {
    return { variant: 'default' as const, label: `En stock (${totalStock})` }
  }
}

function getProductValue(product: Product): number {
  let totalStock = 0
  
  if (product.stockByVariation) {
    totalStock = Object.values(product.stockByVariation).reduce((sum, s) => sum + s, 0)
  } else {
    totalStock = product.stock ?? 0
  }

  return totalStock * (product.purchasePrice ?? product.price)
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 p-4">
    <!-- En-tête avec statistiques -->
    <div class="grid gap-4 md:grid-cols-4">
      <!-- Total produits -->
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-2">
          <Package class="w-5 h-5 text-muted-foreground" />
          <h3 class="text-sm font-medium">Produits</h3>
        </div>
        <p class="text-2xl font-bold mt-2">{{ productsStore.products.length }}</p>
      </div>

      <!-- Valeur du stock -->
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-2">
          <TrendingUp class="w-5 h-5 text-green-600" />
          <h3 class="text-sm font-medium">Valeur stock</h3>
        </div>
        <p class="text-2xl font-bold mt-2">{{ productsStore.totalStockValue.toFixed(2) }} €</p>
      </div>

      <!-- Stock faible -->
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-2">
          <AlertCircle class="w-5 h-5 text-orange-600" />
          <h3 class="text-sm font-medium">Stock faible</h3>
        </div>
        <p class="text-2xl font-bold mt-2">{{ productsStore.lowStockAlerts.length }}</p>
      </div>

      <!-- Rupture -->
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-2">
          <PackageX class="w-5 h-5 text-red-600" />
          <h3 class="text-sm font-medium">Rupture</h3>
        </div>
        <p class="text-2xl font-bold mt-2">{{ productsStore.outOfStockAlerts.length }}</p>
      </div>
    </div>

    <!-- Filtres et actions -->
    <div class="flex items-center gap-4">
      <Input
        v-model="searchQuery"
        placeholder="Rechercher un produit..."
        class="max-w-sm"
      />
      
      <Select v-model="stockFilter">
        <SelectTrigger class="w-[180px]">
          <SelectValue placeholder="Filtrer par stock" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les produits</SelectItem>
          <SelectItem value="low">Stock faible</SelectItem>
          <SelectItem value="out">Rupture de stock</SelectItem>
        </SelectContent>
      </Select>

      <div class="ml-auto">
        <Button variant="outline" @click="isHistoryDialogOpen = true">
          <History class="w-4 h-4 mr-2" />
          Historique
        </Button>
      </div>
    </div>

    <!-- Tableau des produits -->
    <div class="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead>Code-barres</TableHead>
            <TableHead class="text-center">Stock</TableHead>
            <TableHead class="text-right">Prix achat</TableHead>
            <TableHead class="text-right">Valeur</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="product in filteredProducts" :key="product.id">
            <!-- Ligne principale du produit -->
            <TableRow>
              <TableCell>
                <div class="flex items-center gap-3">
                  <img :src="product.image" :alt="product.name" class="w-10 h-10 rounded object-cover" />
                  <div>
                    <div class="font-medium">{{ product.name }}</div>
                    <div v-if="product.variationGroupIds?.length" class="text-xs text-muted-foreground">
                      {{ Object.keys(product.stockByVariation || {}).length }} variation(s)
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell class="font-mono text-sm">{{ product.barcode || '—' }}</TableCell>
              <TableCell class="text-center">
                <Badge :variant="getStockBadge(product).variant">
                  {{ getStockBadge(product).label }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                {{ (product.purchasePrice ?? product.price).toFixed(2) }} €
              </TableCell>
              <TableCell class="text-right font-medium">
                {{ getProductValue(product).toFixed(2) }} €
              </TableCell>
              <TableCell class="text-right">
                <Button variant="outline" size="sm" @click="openAdjustDialog(product)">
                  Ajuster
                </Button>
              </TableCell>
            </TableRow>

            <!-- Sous-lignes pour chaque variation -->
            <TableRow
              v-for="[varName, varStock] in Object.entries(product.stockByVariation || {})"
              :key="`${product.id}-${varName}`"
              class="bg-muted/30"
            >
              <TableCell class="pl-16">
                <span class="text-sm text-muted-foreground">↳ {{ varName }}</span>
              </TableCell>
              <TableCell></TableCell>
              <TableCell class="text-center">
                <Badge
                  :variant="varStock === 0 ? 'destructive' : (varStock < 5 ? 'secondary' : 'default')"
                  class="text-xs"
                >
                  {{ varStock === 0 ? 'Rupture' : (varStock < 5 ? `Stock faible (${varStock})` : `${varStock}`) }}
                </Badge>
              </TableCell>
              <TableCell></TableCell>
              <TableCell class="text-right text-muted-foreground">
                {{ (varStock * (product.purchasePrice ?? product.price)).toFixed(2) }} €
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- Dialog d'ajustement -->
    <Dialog v-model:open="isAdjustDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuster le stock</DialogTitle>
          <DialogDescription>
            {{ selectedProduct?.name }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- Sélection variation si nécessaire -->
          <div v-if="selectedProduct?.variationGroupIds?.length">
            <Label>Variation</Label>
            <Select v-model="selectedVariation">
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une variation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="variation in availableVariations"
                  :key="variation"
                  :value="variation"
                >
                  {{ variation }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Type d'ajustement -->
          <div>
            <Label>Type d'ajustement</Label>
            <Select v-model="adjustmentType">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Ajouter au stock</SelectItem>
                <SelectItem value="set">Définir le stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Quantité -->
          <div>
            <Label>{{ adjustmentType === 'add' ? 'Quantité à ajouter' : 'Nouveau stock' }}</Label>
            <Input
              v-model.number="adjustmentQuantity"
              type="number"
              min="0"
              placeholder="0"
            />
          </div>

          <!-- Stock actuel -->
          <div v-if="selectedProduct" class="rounded-lg bg-muted p-3">
            <p class="text-sm text-muted-foreground">
              Stock actuel
              <span v-if="selectedVariation"> ({{ selectedVariation }})</span>
              <span v-else-if="selectedProduct.variationGroupIds?.length"> (total)</span>
            </p>
            <p class="text-lg font-semibold">
              {{ currentStock }}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isAdjustDialogOpen = false">
            Annuler
          </Button>
          <Button @click="applyAdjustment">
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog historique -->
    <Dialog v-model:open="isHistoryDialogOpen">
      <DialogContent class="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Historique des mouvements de stock</DialogTitle>
          <DialogDescription>
            {{ productsStore.stockHistory.length }} mouvement(s) enregistré(s)
          </DialogDescription>
        </DialogHeader>

        <div class="overflow-y-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Variation</TableHead>
                <TableHead class="text-center">Mouvement</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead class="text-right">Stock avant</TableHead>
                <TableHead class="text-right">Stock après</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="movement in productsStore.stockHistory.slice().reverse()" :key="movement.id">
                <TableCell class="text-xs">
                  {{ new Date(movement.date).toLocaleString('fr-FR') }}
                </TableCell>
                <TableCell>{{ movement.productName }}</TableCell>
                <TableCell>{{ movement.variation || '—' }}</TableCell>
                <TableCell class="text-center">
                  <Badge :variant="movement.quantity > 0 ? 'default' : 'secondary'">
                    {{ movement.quantity > 0 ? '+' : '' }}{{ movement.quantity }}
                  </Badge>
                </TableCell>
                <TableCell class="text-xs">{{ movement.reason }}</TableCell>
                <TableCell class="text-right">{{ movement.oldStock }}</TableCell>
                <TableCell class="text-right font-medium">{{ movement.newStock }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>