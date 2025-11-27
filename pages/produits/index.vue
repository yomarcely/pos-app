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
    <ProductsSearchBar
      v-model:search-query="searchQuery"
      v-model:selected-category-id="selectedCategoryId"
      v-model:view-mode="viewMode"
      :categories="categories"
      @search="debouncedSearch"
      @category-change="loadProducts"
    />

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>

    <!-- Vue en liste (tableau) -->
    <ProductsTableView
      v-else-if="viewMode === 'list' && products.length > 0"
      :products="products"
      @view="viewProduct"
      @edit="editProduct"
      @delete="deleteProduct"
    />

    <!-- Vue en grille (cartes) -->
    <ProductsGridView
      v-else-if="viewMode === 'grid' && products.length > 0"
      :products="products"
      @edit="editProduct"
      @delete="deleteProduct"
    />

    <!-- État vide -->
    <ProductsEmptyState
      v-else-if="!loading && products.length === 0"
      :message="searchQuery || selectedCategoryId ? 'Essayez de modifier vos filtres' : 'Créez votre premier produit pour commencer'"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useToast } from '@/composables/useToast'
import ProductsSearchBar from '@/components/produits/ProductsSearchBar.vue'
import ProductsTableView from '@/components/produits/ProductsTableView.vue'
import ProductsGridView from '@/components/produits/ProductsGridView.vue'
import ProductsEmptyState from '@/components/produits/ProductsEmptyState.vue'
import type { Product, Category } from '@/types/produits'

const toast = useToast()

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
