<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Catalogue produits"
      :description="`${filteredCount} produit(s)`"
    >
      <template #actions>
        <Button @click="navigateTo('/produits/create')">
          <Plus class="w-4 h-4 mr-2" />
          Nouveau produit
        </Button>
      </template>
    </PageHeader>

    <!-- Barre de recherche et filtres -->
    <ProductsSearchBar
      v-model:search-query="searchQuery"
      v-model:selected-category-id="selectedCategoryId"
      v-model:selected-brand-id="selectedBrandId"
      v-model:selected-supplier-id="selectedSupplierId"
      v-model:show-archived="showArchived"
      v-model:view-mode="viewMode"
      :categories="categories"
      :brands="brands"
      :suppliers="suppliers"
      @search="debouncedSearch"
      @category-change="loadProducts"
      @filter-change="loadProducts"
      @reset-filters="resetFilters"
    />

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des produits..." />

    <!-- Vue en liste (tableau) -->
    <ProductsTableView
      v-else-if="viewMode === 'list' && products.length > 0"
      :products="products"
      @view="viewProduct"
      @edit="editProduct"
      @delete="deleteProduct"
      @duplicate="duplicateProduct"
      @archive="archiveProduct"
      @unarchive="unarchiveProduct"
    />

    <!-- Vue en grille (cartes) -->
    <ProductsGridView
      v-else-if="viewMode === 'grid' && products.length > 0"
      :products="products"
      @edit="editProduct"
      @delete="deleteProduct"
      @duplicate="duplicateProduct"
      @archive="archiveProduct"
      @unarchive="unarchiveProduct"
    />

    <!-- État vide -->
    <ProductsEmptyState
      v-else-if="!loading && products.length === 0"
      :message="searchQuery || selectedCategoryId || selectedBrandId || selectedSupplierId ? 'Essayez de modifier vos filtres' : 'Créez votre premier produit pour commencer'"
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
import PageHeader from '@/components/common/PageHeader.vue'
import ProductsSearchBar from '@/components/produits/ProductsSearchBar.vue'
import ProductsTableView from '@/components/produits/ProductsTableView.vue'
import ProductsGridView from '@/components/produits/ProductsGridView.vue'
import ProductsEmptyState from '@/components/produits/ProductsEmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { Product, Brand, Supplier } from '@/types'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

const toast = useToast()
type ProductsResponse = { products: Product[]; count: number }

// State
const loading = ref(true)
const products = ref<Product[]>([])
interface CategoryTree {
  id: number
  name: string
  parentId: number | null
  children?: CategoryTree[]
}

const categories = ref<CategoryTree[]>([])
const brands = ref<Brand[]>([])
const suppliers = ref<Supplier[]>([])
const searchQuery = ref('')
const selectedCategoryId = ref<number | null>(null)
const selectedBrandId = ref<number | null>(null)
const selectedSupplierId = ref<number | null>(null)
const showArchived = ref(false)
const viewMode = ref<'list' | 'grid'>('grid')
const filteredCount = ref(0)
const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

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

    const params: Record<string, string | number | boolean> = {}
    if (searchQuery.value && searchQuery.value.trim() !== '') {
      params.search = searchQuery.value.trim()
    }
    if (selectedCategoryId.value) params.categoryId = selectedCategoryId.value
    if (selectedBrandId.value) params.brandId = selectedBrandId.value
    if (selectedSupplierId.value) params.supplierId = selectedSupplierId.value
    if (showArchived.value) params.onlyArchived = 'true'
    if (selectedEstablishmentId.value) params.establishmentId = selectedEstablishmentId.value

    const response = await $fetch<ProductsResponse>('/api/products', { params })
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
    const response = await $fetch('/api/categories', {
      params: selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined,
    })

    categories.value = response.categories
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error)
  }
}

// Charger les marques
async function loadBrands() {
  try {
    const params = selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined
    brands.value = await $fetch<Brand[]>('/api/brands', { params })
  } catch (error) {
    console.error('Erreur lors du chargement des marques:', error)
  }
}

// Charger les fournisseurs
async function loadSuppliers() {
  try {
    const params = selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined
    suppliers.value = await $fetch<Supplier[]>('/api/suppliers', { params })
  } catch (error) {
    console.error('Erreur lors du chargement des fournisseurs:', error)
  }
}

// Réinitialiser les filtres
function resetFilters() {
  searchQuery.value = ''
  selectedCategoryId.value = null
  selectedBrandId.value = null
  selectedSupplierId.value = null
  showArchived.value = false
  loadProducts()
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
  } catch (error: unknown) {
    console.error('Erreur lors de la suppression du produit:', error)
    toast.error(extractFetchError(error, 'Erreur lors de la suppression du produit'))
  }
}

async function duplicateProduct(product: Product) {
  try {
    const response = await $fetch<{ product: { id: number } }>(`/api/products/${product.id}/duplicate`, {
      method: 'POST',
    })
    toast.success(`Produit "${product.name}" dupliqué`)
    navigateTo(`/produits/${response.product.id}/edit`)
  } catch (error: unknown) {
    console.error('Erreur lors de la duplication du produit:', error)
    toast.error(extractFetchError(error, 'Erreur lors de la duplication du produit'))
  }
}

async function archiveProduct(product: Product) {
  if (!confirm(`Archiver "${product.name}" ? Il ne sera plus visible dans la liste par défaut.`)) return

  try {
    await $fetch(`/api/products/${product.id}/archive`, { method: 'POST' })
    toast.success(`Produit "${product.name}" archivé`)
    await loadProducts()
  } catch (error: unknown) {
    console.error('Erreur lors de l\'archivage du produit:', error)
    toast.error(extractFetchError(error, 'Erreur lors de l\'archivage du produit'))
  }
}

async function unarchiveProduct(product: Product) {
  try {
    await $fetch(`/api/products/${product.id}/unarchive`, { method: 'POST' })
    toast.success(`Produit "${product.name}" désarchivé`)
    await loadProducts()
  } catch (error: unknown) {
    console.error('Erreur lors du désarchivage du produit:', error)
    toast.error(extractFetchError(error, 'Erreur lors du désarchivage du produit'))
  }
}

// Charger au montage
onMounted(async () => {
  await initializeEstablishments()
  await Promise.all([loadCategories(), loadProducts(), loadBrands(), loadSuppliers()])
})

watch(selectedEstablishmentId, async () => {
  await Promise.all([loadCategories(), loadProducts()])
})
</script>
