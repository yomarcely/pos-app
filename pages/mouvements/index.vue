<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Mouvements de stock"
      description="Gérer les entrées, sorties et ajustements de stock"
    />

    <!-- Type de mouvement -->
    <MovementTypeSelector v-model="movementType" />

    <!-- Motif/Commentaire -->
    <Card>
      <CardHeader>
        <CardTitle>Motif / Commentaire</CardTitle>
      </CardHeader>
      <CardContent>
        <textarea
          v-model="comment"
          class="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm"
          placeholder="Précisez le motif de ce mouvement (optionnel)..."
        ></textarea>
      </CardContent>
    </Card>

    <!-- Recherche de produits -->
    <ProductSearchWithSuggestions
      v-model:search-query="searchQuery"
      :suggestions="searchSuggestions"
      @search="searchProduct"
      @select-first="selectFirstSuggestion"
      @clear-suggestions="searchSuggestions = []"
      @focus="handleSearchFocus"
      @select-product="selectProductFromSuggestion"
      @open-catalog="openProductSelector"
    />

    <!-- Table des produits sélectionnés -->
    <SelectedProductsTable
      :selected-products="selectedProducts"
      :movement-type="movementType"
      :all-variations="allVariations"
      @update-quantity="updateProductQuantity"
      @remove-product="removeProduct"
      @clear-all="clearAll"
      @validate="validateMovement"
    />

    <!-- Dialog sélecteur de produits -->
    <ProductCatalogDialog
      v-model:open="isProductSelectorOpen"
      v-model:search-query="catalogSearchQuery"
      v-model:selected-category="selectedCategoryFilter"
      v-model:selected-supplier="selectedSupplierFilter"
      v-model:selected-brand="selectedBrandFilter"
      :products="catalogProducts"
      :categories="categories"
      :suppliers="suppliers"
      :brands="brands"
      :loading="loadingCatalog"
      @select-product="addProductFromCatalog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/common/PageHeader.vue'
import MovementTypeSelector from '@/components/mouvements/MovementTypeSelector.vue'
import ProductSearchWithSuggestions from '@/components/shared/ProductSearchWithSuggestions.vue'
import ProductCatalogDialog from '@/components/mouvements/ProductCatalogDialog.vue'
import SelectedProductsTable from '@/components/mouvements/SelectedProductsTable.vue'
import type { MovementType, Product } from '@/types/mouvements'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useMovementCatalog } from '@/composables/useMovementCatalog'
import { useMovementCart } from '@/composables/useMovementCart'
import { useMovementProductSearch } from '@/composables/useMovementProductSearch'

definePageMeta({
  layout: 'dashboard'
})

const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

const movementType = ref<MovementType>('entry')

const {
  isProductSelectorOpen,
  catalogSearchQuery,
  selectedCategoryFilter,
  selectedSupplierFilter,
  selectedBrandFilter,
  catalogProducts,
  loadingCatalog,
  categories,
  suppliers,
  brands,
  allVariations,
  openProductSelector,
  loadCatalogProducts,
  loadCategories,
  loadSuppliers,
  loadBrands,
  loadVariations,
} = useMovementCatalog(selectedEstablishmentId)

const {
  selectedProducts,
  comment,
  addProductFromCatalog,
  updateProductQuantity,
  removeProduct,
  clearAll,
  validateMovement,
} = useMovementCart(movementType, allVariations, () => {
  isProductSelectorOpen.value = false
})

const {
  searchQuery,
  searchSuggestions,
  handleSearchFocus,
  selectFirstSuggestion,
  selectProductFromSuggestion,
  searchProduct,
} = useMovementProductSearch(
  selectedEstablishmentId,
  (product: Product) => addProductFromCatalog(product),
  (products?: Product[]) => {
    if (products) catalogProducts.value = products
    isProductSelectorOpen.value = true
  }
)

onMounted(async () => {
  await initializeEstablishments()
  await Promise.all([loadCategories(), loadSuppliers(), loadBrands(), loadVariations(), loadCatalogProducts()])
})

watch(selectedEstablishmentId, async () => {
  searchSuggestions.value = []
  await Promise.all([loadCategories(), loadVariations(), loadCatalogProducts()])
})
</script>
