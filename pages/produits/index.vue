<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Catalogue produits</h1>
        <p class="text-muted-foreground mt-1">
          {{ filteredCount }} produit(s)
        </p>
      </div>
      <Button @click="navigateTo('/produits/create')">
        <Plus class="w-4 h-4 mr-2" />
        Nouveau produit
      </Button>
    </div>

    <!-- Barre de recherche et filtres -->
    <Card>
      <CardContent class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Recherche -->
          <div class="md:col-span-2 relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Rechercher par nom ou code-barres..."
              class="pl-10"
              @input="debouncedSearch"
            />
          </div>

          <!-- Filtre catégorie -->
          <div>
            <select
              v-model="selectedCategoryId"
              class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              @change="loadProducts"
            >
              <option :value="null">Toutes les catégories</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </div>

          <!-- Toggle vue -->
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              :class="{ 'bg-accent': viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              <List class="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              :class="{ 'bg-accent': viewMode === 'grid' }"
              @click="viewMode = 'grid'"
            >
              <Grid class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>

    <!-- Vue en liste (tableau) -->
    <Card v-else-if="viewMode === 'list' && products.length > 0">
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
                  class="hover:bg-muted/50 transition-colors"
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
                    {{ formatPrice(calculatePriceTTC(product.price, product.tva)) }}
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
                    <div class="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" @click="viewProduct(product)">
                        <Eye class="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" @click="editProduct(product)">
                        <Edit class="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" @click="deleteProduct(product)">
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

    <!-- Vue en grille (cartes) -->
    <div v-else-if="viewMode === 'grid' && products.length > 0" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card
        v-for="product in products"
        :key="product.id"
        class="hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
        @click="viewProduct(product)"
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
                {{ formatPrice(calculatePriceTTC(product.price, product.tva)) }}
              </div>
              <div class="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6"
                  @click.stop="editProduct(product)"
                >
                  <Edit class="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6"
                  @click.stop="deleteProduct(product)"
                >
                  <Trash2 class="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- État vide -->
    <div v-else-if="!loading && products.length === 0" class="text-center py-12">
      <Package class="w-16 h-16 mx-auto text-muted-foreground mb-4" />
      <p class="text-muted-foreground text-lg">Aucun produit trouvé</p>
      <p class="text-muted-foreground text-sm">
        {{ searchQuery || selectedCategoryId ? 'Essayez de modifier vos filtres' : 'Créez votre premier produit pour commencer' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus, Search, List, Grid, Package, Eye, Edit, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Product {
  id: number
  name: string
  barcode: string
  categoryId: number | null
  categoryName: string | null
  price: number
  purchasePrice?: number
  tva: number
  stock: number
  stockByVariation?: Record<string, number>
  image: string | null
  description: string
  isArchived: boolean | null
}

interface Category {
  id: number
  name: string
}

// State
const loading = ref(true)
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const searchQuery = ref('')
const selectedCategoryId = ref<number | null>(null)
const viewMode = ref<'list' | 'grid'>('grid')
const filteredCount = ref(0)

// Debounced search
let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadProducts()
  }, 300)
}

// Charger les produits
async function loadProducts() {
  try {
    loading.value = true

    const params: any = {}
    if (searchQuery.value && searchQuery.value.trim() !== '') {
      params.search = searchQuery.value.trim()
    }
    if (selectedCategoryId.value) params.categoryId = selectedCategoryId.value

    const response = await $fetch('/api/products', { params })
    products.value = response.products
    filteredCount.value = response.count
  } catch (error) {
    console.error('Erreur lors du chargement des produits:', error)
    toast.error('Erreur lors du chargement des produits')
  } finally {
    loading.value = false
  }
}

// Charger les catégories
async function loadCategories() {
  try {
    const response = await $fetch('/api/categories')

    // Aplatir l'arbre des catégories
    const flattenCategories = (cats: any[], level = 0): Category[] => {
      let result: Category[] = []
      for (const cat of cats) {
        result.push({
          id: cat.id,
          name: '  '.repeat(level) + cat.name,
        })
        if (cat.children && cat.children.length > 0) {
          result = result.concat(flattenCategories(cat.children, level + 1))
        }
      }
      return result
    }

    categories.value = flattenCategories(response.categories)
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error)
  }
}

// Helper functions
function calculatePriceTTC(priceHT: number, tva: number): number {
  return priceHT * (1 + tva / 100)
}

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
  // Si le produit a des variations, calculer le stock total
  if (product.stockByVariation && Object.keys(product.stockByVariation).length > 0) {
    return Object.values(product.stockByVariation).reduce((sum, qty) => sum + qty, 0)
  }
  // Sinon retourner le stock simple
  return product.stock || 0
}

// Actions
function viewProduct(product: Product) {
  navigateTo(`/produits/${product.id}`)
}

function editProduct(product: Product) {
  navigateTo(`/produits/${product.id}/edit`)
}

async function deleteProduct(product: Product) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer "${product.name}" ?`)) return

  try {
    await $fetch(`/api/products/${product.id}/delete`, {
      method: 'DELETE' as any,
    })

    toast.success('Produit supprimé avec succès')
    await loadProducts()
  } catch (error: any) {
    console.error('Erreur lors de la suppression du produit:', error)
    toast.error(error.data?.message || 'Erreur lors de la suppression du produit')
  }
}

// Charger au montage
onMounted(async () => {
  await Promise.all([loadCategories(), loadProducts()])
})
</script>
