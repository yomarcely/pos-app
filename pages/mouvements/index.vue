<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Mouvements de stock"
      description="Gérer les entrées, sorties et ajustements de stock"
    />

    <!-- Type de mouvement -->
    <MovementTypeSelector v-model="movementType" />

    <!-- ============================================================ -->
    <!-- Flux Préparation inventaire                                  -->
    <!-- ============================================================ -->
    <template v-if="movementType === 'inventory-prep'">
      <Card>
        <CardHeader>
          <CardTitle>Informations de la préparation</CardTitle>
        </CardHeader>
        <CardContent class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label for="prep-name" class="mb-1 block">Nom (optionnel)</Label>
            <Input
              id="prep-name"
              v-model="prepName"
              placeholder="Ex : Inventaire chaussures Q2"
              maxlength="255"
            />
          </div>
          <div>
            <Label for="prep-comment" class="mb-1 block">Commentaire (optionnel)</Label>
            <Input
              id="prep-comment"
              v-model="prepComment"
              placeholder="Notes éventuelles..."
              maxlength="1000"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pré-remplir par catégorie</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col md:flex-row gap-3 md:items-end">
          <div class="flex-1">
            <Label class="mb-1 block">Catégorie</Label>
            <SearchableSelect
              v-model="prefillCategoryId"
              :items="categoryItems"
              placeholder="Sélectionner une catégorie..."
              search-placeholder="Rechercher une catégorie..."
              empty-text="Aucune catégorie"
            />
          </div>
          <Button
            :disabled="!prefillCategoryId || prefillLoading"
            @click="handlePrefillFromCategory"
          >
            {{ prefillLoading ? 'Ajout...' : 'Ajouter les articles de la catégorie' }}
          </Button>
        </CardContent>
      </Card>

      <ProductSearchWithSuggestions
        v-model:search-query="searchQuery"
        :suggestions="searchSuggestions"
        title="Ajouter un produit"
        @search="searchProduct"
        @select-first="selectFirstSuggestion"
        @clear-suggestions="searchSuggestions = []"
        @focus="handleSearchFocus"
        @select-product="selectProductFromSuggestion"
        @open-catalog="openProductSelector"
      />

      <InventoryPreparationTable
        :lines="prepLines"
        @update-counted-stock="prepUpdateCountedStock"
        @remove-line="prepRemoveLine"
        @clear-all="prepClearAll"
        @validate="prepValidate"
      />

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
        @select-product="prepAddProductFromCatalog"
      />
    </template>

    <!-- ============================================================ -->
    <!-- Flux classique : entry / adjustment / loss                   -->
    <!-- ============================================================ -->
    <template v-else>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/common/PageHeader.vue'
import MovementTypeSelector from '@/components/mouvements/MovementTypeSelector.vue'
import ProductSearchWithSuggestions from '@/components/shared/ProductSearchWithSuggestions.vue'
import SearchableSelect from '@/components/shared/SearchableSelect.vue'
import ProductCatalogDialog from '@/components/mouvements/ProductCatalogDialog.vue'
import SelectedProductsTable from '@/components/mouvements/SelectedProductsTable.vue'
import InventoryPreparationTable from '@/components/mouvements/InventoryPreparationTable.vue'
import type { MovementType, Product } from '@/types/mouvements'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useMovementCatalog } from '@/composables/useMovementCatalog'
import { useMovementCart } from '@/composables/useMovementCart'
import { useMovementProductSearch } from '@/composables/useMovementProductSearch'
import { useInventoryPreparation } from '@/composables/useInventoryPreparation'

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

// Flux classique
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
}, selectedEstablishmentId)

// Flux préparation inventaire
const {
  name: prepName,
  comment: prepComment,
  lines: prepLines,
  addProductFromCatalog: prepAddProductFromCatalogRaw,
  addAllFromCategory,
  updateCountedStock: prepUpdateCountedStock,
  removeLine: prepRemoveLine,
  clearAll: prepClearAll,
  validate: prepValidateRaw,
} = useInventoryPreparation(allVariations, selectedEstablishmentId)

function prepAddProductFromCatalog(product: Product) {
  prepAddProductFromCatalogRaw(product)
  isProductSelectorOpen.value = false
}

async function prepValidate() {
  await prepValidateRaw()
}

// Recherche unifiée : dispatch vers le bon flux selon le type sélectionné
const {
  searchQuery,
  searchSuggestions,
  handleSearchFocus,
  selectFirstSuggestion,
  selectProductFromSuggestion,
  searchProduct,
} = useMovementProductSearch(
  selectedEstablishmentId,
  (product: Product) => {
    if (movementType.value === 'inventory-prep') {
      prepAddProductFromCatalog(product)
    } else {
      addProductFromCatalog(product)
    }
  },
  (products?: Product[]) => {
    if (products) catalogProducts.value = products
    isProductSelectorOpen.value = true
  }
)

// Pré-remplissage par catégorie
const prefillCategoryId = ref<number | null>(null)
const prefillLoading = ref(false)

const categoryItems = computed(() =>
  categories.value.map((c) => ({ id: c.id, label: c.name.trim() })),
)

async function handlePrefillFromCategory() {
  if (!prefillCategoryId.value) return
  prefillLoading.value = true
  await addAllFromCategory(prefillCategoryId.value)
  prefillLoading.value = false
}

onMounted(async () => {
  await initializeEstablishments()
  await Promise.all([loadCategories(), loadSuppliers(), loadBrands(), loadVariations(), loadCatalogProducts()])
})

watch(selectedEstablishmentId, async () => {
  searchSuggestions.value = []
  await Promise.all([loadCategories(), loadVariations(), loadCatalogProducts()])
})
</script>
