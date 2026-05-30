<template>
  <div class="p-6 space-y-6">
    <PageHeader
      title="Réception fournisseur"
      description="Enregistrer une réception de marchandises depuis un fournisseur"
    />

    <!-- Fournisseur + N° BL -->
    <Card>
      <CardHeader>
        <CardTitle>Fournisseur</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label class="mb-2 block">Fournisseur <span class="text-destructive">*</span></Label>
            <SearchableSelect
              v-model="selectedSupplierId"
              :items="supplierItems"
              placeholder="Sélectionner un fournisseur..."
              search-placeholder="Rechercher un fournisseur..."
              empty-text="Aucun fournisseur trouvé"
            />
          </div>
          <div>
            <Label for="bl-number" class="mb-2 block">
              N° de bon de livraison <span class="text-destructive">*</span>
            </Label>
            <Input
              id="bl-number"
              v-model="deliveryNoteNumber"
              placeholder="BL-2026-..."
              maxlength="100"
            />
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Commentaire -->
    <Card>
      <CardHeader>
        <CardTitle>Commentaire (optionnel)</CardTitle>
      </CardHeader>
      <CardContent>
        <textarea
          v-model="comment"
          class="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm"
          placeholder="Notes sur la réception (état, écarts, etc.)..."
        ></textarea>
      </CardContent>
    </Card>

    <!-- Bloc article : actif uniquement si fournisseur sélectionné -->
    <template v-if="selectedSupplierId">
      <ProductSearchWithSuggestions
        v-model:search-query="searchQuery"
        :suggestions="searchSuggestions"
        title="Articles à réceptionner"
        :subtitle="`Recherche limitée aux articles du fournisseur sélectionné`"
        @search="searchProduct"
        @select-first="selectFirstSuggestion"
        @clear-suggestions="searchSuggestions = []"
        @focus="handleSearchFocus"
        @select-product="selectProductFromSuggestion"
        @open-catalog="openProductSelector"
      />

      <SelectedProductsTable
        :selected-products="selectedProducts"
        :movement-type="movementType"
        :all-variations="allVariations"
        @update-quantity="updateProductQuantity"
        @remove-product="removeProduct"
        @clear-all="clearAll"
        @validate="handleValidate"
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
        @select-product="addProductFromCatalog"
      />
    </template>

    <Card v-else>
      <CardContent class="py-8 text-center text-muted-foreground">
        Sélectionnez un fournisseur pour rechercher et ajouter des articles à la réception.
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PageHeader from '@/components/common/PageHeader.vue'
import ProductSearchWithSuggestions from '@/components/shared/ProductSearchWithSuggestions.vue'
import SearchableSelect from '@/components/shared/SearchableSelect.vue'
import ProductCatalogDialog from '@/components/mouvements/ProductCatalogDialog.vue'
import SelectedProductsTable from '@/components/mouvements/SelectedProductsTable.vue'
import type { MovementType, Product } from '@/types/mouvements'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useMovementCatalog } from '@/composables/useMovementCatalog'
import { useMovementCart } from '@/composables/useMovementCart'
import { useMovementProductSearch } from '@/composables/useMovementProductSearch'
import { useToast } from '@/composables/useToast'

definePageMeta({
  layout: 'dashboard'
})

const toast = useToast()
const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

// État réception
const selectedSupplierId = ref<number | null>(null)
const deliveryNoteNumber = ref('')

// Type figé à 'entry' (mappé vers reception côté backend par useMovementCart)
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
} = useMovementCatalog(selectedEstablishmentId, selectedSupplierId)

const supplierItems = computed(() =>
  suppliers.value.map((s) => ({ id: s.id, label: s.name }))
)

const {
  selectedProducts,
  comment,
  addProductFromCatalog,
  updateProductQuantity,
  removeProduct,
  clearAll,
  validateMovement,
} = useMovementCart(
  movementType,
  allVariations,
  () => { isProductSelectorOpen.value = false },
  selectedEstablishmentId,
  { supplierId: selectedSupplierId, deliveryNoteNumber }
)

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
  },
  selectedSupplierId
)

function handleValidate() {
  if (!selectedSupplierId.value) {
    toast.error('Veuillez sélectionner un fournisseur')
    return
  }
  if (!deliveryNoteNumber.value.trim()) {
    toast.error('Veuillez saisir le numéro de bon de livraison')
    return
  }
  validateMovement().then(() => {
    // Reset des champs réception après succès (clearAll vide déjà le panier)
    if (selectedProducts.value.length === 0) {
      deliveryNoteNumber.value = ''
    }
  })
}

// Changement de fournisseur : vider le panier et les suggestions (articles d'un autre fournisseur)
watch(selectedSupplierId, () => {
  selectedProducts.value = []
  searchSuggestions.value = []
  searchQuery.value = ''
})

onMounted(async () => {
  await initializeEstablishments()
  await Promise.all([loadCategories(), loadSuppliers(), loadBrands(), loadVariations()])
})

watch(selectedEstablishmentId, async () => {
  searchSuggestions.value = []
  await Promise.all([loadCategories(), loadVariations(), loadCatalogProducts()])
})
</script>
