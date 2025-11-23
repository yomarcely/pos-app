<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, computed, onMounted } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useVariationGroupsStore } from '@/stores/variationGroups'
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
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Package, TrendingUp, AlertCircle, PackageX, History, ChevronDown, ChevronRight, Trash2 } from 'lucide-vue-next'

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

// Computed pour obtenir les variations disponibles du produit sélectionné
const availableVariations = computed(() => {
  if (!selectedProduct.value?.stockByVariation) return []
  return Object.keys(selectedProduct.value.stockByVariation).map(id => ({
    id: parseInt(id),
    name: getVariationNameById(parseInt(id))
  }))
})

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

// Produit sélectionné pour ajustement
const selectedProduct = ref<Product | null>(null)
const adjustmentQuantity = ref(0)
const adjustmentType = ref<'add' | 'set'>('add')
const isAdjustDialogOpen = ref(false)
const adjustmentsByVariation = ref<Record<string, number>>({})

// Historique
const isHistoryDialogOpen = ref(false)
const stockHistory = ref<any[]>([])
const loadingHistory = ref(false)

async function loadStockHistory() {
  loadingHistory.value = true
  try {
    const response = await $fetch('/api/products/stock-movements')
    if (response.success) {
      stockHistory.value = response.movements
    }
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error)
  } finally {
    loadingHistory.value = false
  }
}

async function openHistoryDialog() {
  isHistoryDialogOpen.value = true
  await loadStockHistory()
}

async function deleteMovement(movementId: number) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cet ajustement ? Le stock sera restauré à sa valeur précédente.')) {
    return
  }

  try {
    const response = await $fetch(`/api/products/stock-movements/${movementId}`, {
      method: 'DELETE',
    })

    if (response.success) {
      // Recharger l'historique
      await loadStockHistory()

      // Recharger les produits pour avoir les stocks à jour
      productsStore.loaded = false
      await productsStore.loadProducts()

      console.log('✅ Mouvement supprimé:', response.movement)
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du mouvement:', error)
    alert('Erreur lors de la suppression du mouvement')
  }
}

// Compter le nombre total de variations en stock faible
const lowStockVariationsCount = computed(() => {
  let count = 0
  productsStore.lowStockAlerts.forEach(alert => {
    if (alert.variations && alert.variations.length > 0) {
      // Si le produit a des variations, compter le nombre de variations en stock faible
      count += alert.variations.length
    } else {
      // Si le produit n'a pas de variations, compter 1
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
      // Si le produit a des variations, compter le nombre de variations en rupture
      count += alert.variations.length
    } else {
      // Si le produit n'a pas de variations, compter 1
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

  // Initialiser les ajustements par variation à 0
  if (product.variationGroupIds?.length && product.stockByVariation) {
    adjustmentsByVariation.value = {}
    Object.keys(product.stockByVariation).forEach(varId => {
      adjustmentsByVariation.value[varId] = 0
    })
  }

  isAdjustDialogOpen.value = true
}

async function applyAdjustment() {
  if (!selectedProduct.value) return

  const product = selectedProduct.value

  try {
    // Si le produit a des variations, traiter chaque variation
    if (product.variationGroupIds?.length) {
      const promises = []
      for (const [varId, quantity] of Object.entries(adjustmentsByVariation.value)) {
        if (quantity !== 0) { // Ne traiter que les variations avec une quantité non nulle
          promises.push(
            $fetch('/api/products/update-stock', {
              method: 'POST',
              body: {
                productId: product.id,
                variation: varId,
                quantity,
                adjustmentType: adjustmentType.value,
                reason: 'inventory_adjustment',
                userId: 1,
              },
            })
          )
        }
      }
      await Promise.all(promises)
    } else {
      // Produit simple sans variation
      await $fetch('/api/products/update-stock', {
        method: 'POST',
        body: {
          productId: product.id,
          variation: undefined,
          quantity: adjustmentQuantity.value,
          adjustmentType: adjustmentType.value,
          reason: 'inventory_adjustment',
          userId: 1,
        },
      })
    }

    // Recharger les produits depuis la base de données
    productsStore.loaded = false
    await productsStore.loadProducts()

    console.log('✅ Stock mis à jour')

    isAdjustDialogOpen.value = false
    selectedProduct.value = null
  } catch (error) {
    console.error('Erreur lors de l\'ajustement du stock:', error)
    alert('Erreur lors de la mise à jour du stock')
  }
}

function getStockBadge(product: Product) {
  let totalStock = 0
  let totalMinStock = 0

  if (product.stockByVariation) {
    totalStock = Object.values(product.stockByVariation).reduce((sum, s) => sum + s, 0)

    // Calculer le minStock total pour les produits avec variations
    if (product.minStockByVariation) {
      totalMinStock = Object.values(product.minStockByVariation).reduce((sum, s) => sum + s, 0)
    } else {
      // Si pas de minStockByVariation, utiliser minStock du produit ou 5 par défaut
      totalMinStock = (product.minStock ?? 5) * Object.keys(product.stockByVariation).length
    }
  } else {
    totalStock = product.stock ?? 0
    totalMinStock = product.minStock ?? 5
  }

  // Traiter les stocks négatifs et nuls comme des ruptures, mais afficher la quantité
  if (totalStock <= 0) {
    return { variant: 'destructive' as const, label: `Rupture (${totalStock})` }
  } else if (totalStock <= totalMinStock) {
    return { variant: 'secondary' as const, label: `Stock faible (${totalStock})` }
  } else {
    return { variant: 'default' as const, label: `En stock (${totalStock})` }
  }
}

function getVariationStockBadge(product: Product, varId: string, varStock: number) {
  const minStock = product.minStockByVariation?.[varId] ?? product.minStock ?? 5

  // Traiter les stocks négatifs et nuls comme des ruptures, mais afficher la quantité
  if (varStock <= 0) {
    return { variant: 'destructive' as const, label: `Rupture (${varStock})` }
  } else if (varStock <= minStock) {
    return { variant: 'secondary' as const, label: `Stock faible (${varStock})` }
  } else {
    return { variant: 'default' as const, label: `${varStock}` }
  }
}

function getProductValue(product: Product): number {
  let totalStock = 0

  if (product.stockByVariation) {
    // Ne compter que les stocks positifs pour la valeur
    totalStock = Object.values(product.stockByVariation).reduce((sum, s) => sum + Math.max(0, s), 0)
  } else {
    // Ne compter que les stocks positifs pour la valeur
    totalStock = Math.max(0, product.stock ?? 0)
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
        <p class="text-2xl font-bold mt-2">{{ lowStockVariationsCount }}</p>
      </div>

      <!-- Rupture -->
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-2">
          <PackageX class="w-5 h-5 text-red-600" />
          <h3 class="text-sm font-medium">Rupture</h3>
        </div>
        <p class="text-2xl font-bold mt-2">{{ outOfStockVariationsCount }}</p>
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
        <Button variant="outline" @click="openHistoryDialog">
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
                  <!-- Bouton pour déplier/replier les variations -->
                  <button
                    v-if="product.variationGroupIds?.length"
                    @click="toggleProductExpansion(product.id)"
                    class="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <ChevronDown v-if="expandedProducts.has(product.id)" class="w-4 h-4 text-muted-foreground" />
                    <ChevronRight v-else class="w-4 h-4 text-muted-foreground" />
                  </button>
                  <div v-else class="w-6"></div>

                  <NuxtLink :to="`/produits/${product.id}/edit`" class="shrink-0">
                    <img :src="product.image || '/placeholder-product.png'" :alt="product.name" class="w-10 h-10 rounded object-cover hover:opacity-80 transition-opacity cursor-pointer" />
                  </NuxtLink>
                  <div>
                    <NuxtLink :to="`/produits/${product.id}/edit`" class="font-medium hover:underline">
                      {{ product.name }}
                    </NuxtLink>
                    <div v-if="product.variationGroupIds?.length" class="text-xs text-muted-foreground">
                      {{ Object.keys(product.stockByVariation || {}).length }} variation(s)
                    </div>
                  </div>
                </div>
              </TableCell>
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

            <!-- Sous-lignes pour chaque variation (affichées seulement si déployé) -->
            <TableRow
              v-if="expandedProducts.has(product.id)"
              v-for="[varId, varStock] in Object.entries(product.stockByVariation || {})"
              :key="`${product.id}-${varId}`"
              class="bg-muted/30"
            >
              <TableCell class="pl-16">
                <span class="text-sm text-muted-foreground">↳ {{ getVariationNameById(parseInt(varId)) }}</span>
              </TableCell>
              <TableCell class="text-center">
                <Badge
                  :variant="getVariationStockBadge(product, varId, varStock).variant"
                  class="text-xs"
                >
                  {{ getVariationStockBadge(product, varId, varStock).label }}
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

          <!-- Produit avec variations : un champ par variation -->
          <div v-if="selectedProduct?.variationGroupIds?.length" class="space-y-3">
            <Label>Ajustements par variation</Label>
            <div
              v-for="variation in availableVariations"
              :key="variation.id"
              class="border rounded-lg p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="font-medium text-sm">{{ variation.name }}</span>
                <Badge variant="outline" class="text-xs">
                  Stock actuel: {{ selectedProduct.stockByVariation?.[variation.id.toString()] ?? 0 }}
                </Badge>
              </div>
              <Input
                v-model.number="adjustmentsByVariation[variation.id.toString()]"
                type="number"
                :placeholder="adjustmentType === 'add' ? 'Quantité à ajouter' : 'Nouveau stock'"
              />
            </div>
          </div>

          <!-- Produit simple : un seul champ -->
          <div v-else>
            <Label>{{ adjustmentType === 'add' ? 'Quantité à ajouter' : 'Nouveau stock' }}</Label>
            <Input
              v-model.number="adjustmentQuantity"
              type="number"
              min="0"
              placeholder="0"
            />
            <!-- Stock actuel -->
            <div v-if="selectedProduct" class="rounded-lg bg-muted p-3 mt-3">
              <p class="text-sm text-muted-foreground">Stock actuel</p>
              <p class="text-lg font-semibold">{{ selectedProduct.stock ?? 0 }}</p>
            </div>
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
            {{ loadingHistory ? 'Chargement...' : `${stockHistory.length} mouvement(s) enregistré(s)` }}
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
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="movement in stockHistory.slice().reverse()" :key="movement.id">
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
                <TableCell class="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="deleteMovement(movement.id)"
                    class="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>