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
import { useToast } from '@/composables/useToast'
import PageHeader from '@/components/common/PageHeader.vue'
import MovementTypeSelector from '@/components/mouvements/MovementTypeSelector.vue'
import ProductSearchWithSuggestions from '@/components/mouvements/ProductSearchWithSuggestions.vue'
import ProductCatalogDialog from '@/components/mouvements/ProductCatalogDialog.vue'
import SelectedProductsTable from '@/components/mouvements/SelectedProductsTable.vue'
import type {
  Product,
  SelectedProduct,
  Variation,
  Category,
  Supplier,
  Brand,
  MovementType
} from '@/types/mouvements'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

definePageMeta({
  layout: 'dashboard'
})

const toast = useToast()

// State
const movementType = ref<MovementType>('entry')
const searchQuery = ref('')
const selectedProducts = ref<SelectedProduct[]>([])
const comment = ref('')
const searchSuggestions = ref<Product[]>([])

// Catalog selector
const isProductSelectorOpen = ref(false)
const catalogSearchQuery = ref('')
const selectedCategoryFilter = ref<number | null>(null)
const selectedSupplierFilter = ref<number | null>(null)
const selectedBrandFilter = ref<number | null>(null)
const catalogProducts = ref<Product[]>([])
const loadingCatalog = ref(false)
const categories = ref<Category[]>([])
const suppliers = ref<Supplier[]>([])
const brands = ref<Brand[]>([])
const allVariations = ref<Variation[]>([])
const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

function normalizeProduct(raw: any): Product {
  const normalizedVariationIds = Array.isArray(raw.variationGroupIds)
    ? raw.variationGroupIds.map((id: any) => {
        const numericId = Number(id)
        return Number.isFinite(numericId) ? numericId : String(id)
      })
    : []

  const normalizedStockByVariation = raw.stockByVariation
    ? Object.fromEntries(
        Object.entries(raw.stockByVariation as Record<string, number | string>).map(([key, value]) => [
          key.toString(),
          Number(value) || 0,
        ]),
      )
    : undefined

  return {
    ...raw,
    stock: raw.stock ?? 0,
    variationGroupIds: normalizedVariationIds.length ? normalizedVariationIds : undefined,
    stockByVariation: normalizedStockByVariation,
  }
}

function hasVariations(product: Product): boolean {
  return !!(
    (product.variationGroupIds && product.variationGroupIds.length > 0) ||
    (product.stockByVariation && Object.keys(product.stockByVariation).length > 0)
  )
}

function getTotalStock(product: Product): number {
  if (product.stockByVariation && Object.keys(product.stockByVariation).length > 0) {
    return Object.values(product.stockByVariation).reduce((sum, qty) => sum + Number(qty || 0), 0)
  }
  return product.stock || 0
}

// Debounced search for suggestions
let searchTimeout: NodeJS.Timeout
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.trim().length < 2) {
      searchSuggestions.value = []
      return
    }

    try {
      const response = await $fetch('/api/products', {
        params: {
          search: searchQuery.value.trim(),
          ...(selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : {})
        }
      })
      searchSuggestions.value = (response.products as any[]).map(normalizeProduct)
    } catch (error) {
      console.error('Erreur lors de la recherche:', error)
    }
  }, 300)
})

// Debounced search for catalog
watch(catalogSearchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadCatalogProducts()
  }, 300)
})

// Watch filters
watch([selectedCategoryFilter, selectedSupplierFilter, selectedBrandFilter], () => {
  loadCatalogProducts()
})

// Handle search focus
function handleSearchFocus() {
  if (searchQuery.value.trim().length >= 2 && searchSuggestions.value.length > 0) {
    // Keep suggestions visible
  }
}

// Select first suggestion on Enter
function selectFirstSuggestion() {
  if (searchSuggestions.value.length > 0) {
    const product = searchSuggestions.value[0]
    if (product) {
      selectProductFromSuggestion(product)
    }
  }
}

// Select product from suggestion
function selectProductFromSuggestion(product: any) {
  addProductFromCatalog(normalizeProduct(product))
  searchQuery.value = ''
  searchSuggestions.value = []
}

// Rechercher un produit par nom ou code-barres
async function searchProduct() {
  if (!searchQuery.value.trim()) return

  try {
    const response = await $fetch('/api/products', {
      params: { search: searchQuery.value.trim() }
    })

    const products = (response.products as any[]).map(normalizeProduct)

    if (products.length === 0) {
      toast.error('Aucun produit trouvé')
      return
    }

    if (products.length === 1 && products[0]) {
      addProductFromCatalog(products[0])
      searchQuery.value = ''
    } else {
      // Ouvrir le sélecteur avec les résultats
      catalogProducts.value = products
      isProductSelectorOpen.value = true
    }
  } catch (error) {
    console.error('Erreur lors de la recherche:', error)
    toast.error('Erreur lors de la recherche')
  }
}

// Ouvrir le sélecteur de produits
function openProductSelector() {
  isProductSelectorOpen.value = true
  loadCatalogProducts()
}

// Charger les produits du catalogue
async function loadCatalogProducts() {
  try {
    loadingCatalog.value = true

    const params: any = {}
    if (catalogSearchQuery.value) params.search = catalogSearchQuery.value
    if (selectedCategoryFilter.value) params.categoryId = selectedCategoryFilter.value
    if (selectedSupplierFilter.value) params.supplierId = selectedSupplierFilter.value
    if (selectedBrandFilter.value) params.brandId = selectedBrandFilter.value
    if (selectedEstablishmentId.value) params.establishmentId = selectedEstablishmentId.value

    const response = await $fetch('/api/products', { params })
    catalogProducts.value = (response.products as any[]).map(normalizeProduct)
  } catch (error) {
    console.error('Erreur lors du chargement du catalogue:', error)
  } finally {
    loadingCatalog.value = false
  }
}

// Charger les catégories
async function loadCategories() {
  try {
    const response = await $fetch('/api/categories', {
      params: selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined,
    })

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

// Charger les fournisseurs
async function loadSuppliers() {
  try {
    const response: any = await $fetch('/api/suppliers')
    suppliers.value = Array.isArray(response) ? response : response.suppliers || []
  } catch (error) {
    console.error('Erreur lors du chargement des fournisseurs:', error)
  }
}

// Charger les marques
async function loadBrands() {
  try {
    const response = await $fetch('/api/brands')
    brands.value = Array.isArray(response) ? response : []
  } catch (error) {
    console.error('Erreur lors du chargement des marques:', error)
  }
}

// Charger les variations
async function loadVariations() {
  try {
    const response = await $fetch('/api/variations/groups', {
      params: selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined,
    })
    // Aplatir tous les groupes et leurs variations
    const flatVariations: Variation[] = []
    for (const group of response.groups as any) {
      for (const variation of group.variations) {
        flatVariations.push({
          id: variation.id,
          name: variation.name,
        })
      }
    }
    allVariations.value = flatVariations
  } catch (error) {
    console.error('Erreur lors du chargement des variations:', error)
  }
}

// Obtenir les variations d'un produit
function getProductVariations(product: Product): Variation[] {
  const idsFromProduct = Array.isArray(product.variationGroupIds)
    ? product.variationGroupIds.map((id) => {
        const numericId = Number(id)
        return Number.isFinite(numericId) ? numericId : String(id)
      })
    : []

  const idsFromStock = product.stockByVariation
    ? Object.keys(product.stockByVariation).map((id) => {
        const numericId = Number(id)
        return Number.isFinite(numericId) ? numericId : id
      })
    : []

  const variationIds = idsFromProduct.length ? idsFromProduct : idsFromStock
  const uniqueIds = Array.from(new Set(variationIds))

  return uniqueIds.map((id) => {
    const numericId = typeof id === 'number' ? id : Number(id)
    const found = Number.isFinite(numericId)
      ? allVariations.value.find((v) => v.id === numericId)
      : undefined

    return found || { id, name: `Variation ${id}` }
  })
}

// Ajouter un produit depuis le catalogue
function addProductFromCatalog(product: Product) {
  const normalizedProduct = normalizeProduct(product)

  // Vérifier si le produit est déjà dans la liste
  const exists = selectedProducts.value.find(p => p.product.id === normalizedProduct.id)
  if (exists) {
    toast.error('Ce produit est déjà dans la liste')
    return
  }

  // Si le produit a des variations, initialiser les quantités par variation
  if (hasVariations(normalizedProduct)) {
    const quantitiesByVariation: Record<string, number> = {}
    const variations = getProductVariations(normalizedProduct)

    variations.forEach(v => {
      const currentStock = normalizedProduct.stockByVariation?.[v.id.toString()] || 0
      quantitiesByVariation[v.id.toString()] = movementType.value === 'adjustment' ? currentStock : 0
    })

    selectedProducts.value.push({
      product: normalizedProduct,
      currentStock: getTotalStock(normalizedProduct),
      quantity: 0,
      quantitiesByVariation,
    })
  } else {
    // Produit simple sans variation
    selectedProducts.value.push({
      product: normalizedProduct,
      currentStock: normalizedProduct.stock || 0,
      quantity: movementType.value === 'adjustment' ? normalizedProduct.stock || 0 : 0,
    })
  }

  toast.success('Produit ajouté')
  isProductSelectorOpen.value = false
}

// Update product quantity
function updateProductQuantity(productId: number, variationId: string | null, quantity: number) {
  const item = selectedProducts.value.find(p => p.product.id === productId)
  if (!item) return

  if (variationId && item.quantitiesByVariation) {
    item.quantitiesByVariation[variationId] = quantity
  } else {
    item.quantity = quantity
  }
}

// Retirer un produit
function removeProduct(productId: number) {
  selectedProducts.value = selectedProducts.value.filter(
    item => item.product.id !== productId
  )
}

// Tout effacer
function clearAll() {
  selectedProducts.value = []
  comment.value = ''
}

// Valider le mouvement
async function validateMovement() {
  if (selectedProducts.value.length === 0) {
    toast.error('Aucun produit sélectionné')
    return
  }

  try {
    // Déterminer le type de mouvement et l'adjustmentType pour l'API
    let type: 'reception' | 'adjustment' | 'loss' | 'transfer'
    let adjustmentType: 'add' | 'set' = 'add'

    if (movementType.value === 'entry') {
      type = 'reception'
      adjustmentType = 'add'
    } else if (movementType.value === 'adjustment') {
      type = 'adjustment'
      adjustmentType = 'set'
    } else {
      type = 'loss'
      adjustmentType = 'add'
    }

    // Construire la liste des items
    const items: any[] = []

    for (const item of selectedProducts.value) {
      // Si le produit a des variations, traiter chaque variation
      if (hasVariations(item.product) && item.quantitiesByVariation) {
        for (const [varId, quantity] of Object.entries(item.quantitiesByVariation)) {
          // Ignorer les champs vides ou à 0 (sauf en mode ajustement où 0 est valide)
          if (quantity === null || quantity === undefined) continue
          if (movementType.value !== 'adjustment' && quantity === 0) continue

          let finalQuantity = quantity

          // Pour les pertes, on met une quantité négative
          if (movementType.value === 'loss') {
            finalQuantity = -Math.abs(quantity)
          }

          items.push({
            productId: item.product.id,
            variation: varId,
            quantity: finalQuantity,
            adjustmentType,
          })
        }
      } else {
        // Produit simple sans variation
        if (!item.quantity && item.quantity !== 0) {
          continue
        }

        if (movementType.value !== 'adjustment' && item.quantity === 0) {
          continue
        }

        let finalQuantity = item.quantity

        // Pour les pertes, on met une quantité négative
        if (movementType.value === 'loss') {
          finalQuantity = -Math.abs(finalQuantity)
        }

        items.push({
          productId: item.product.id,
          quantity: finalQuantity,
          adjustmentType,
        })
      }
    }

    if (items.length === 0) {
      toast.error('Aucune quantité à traiter')
      return
    }

    // Créer le mouvement groupé
    const response = await $fetch('/api/movements/create', {
      method: 'POST',
      body: {
        type,
        comment: comment.value || undefined,
        userId: 1,
        items,
      },
    }) as any

    toast.success(`Mouvement ${response.movement.movementNumber} créé avec succès`)
    clearAll()
  } catch (error: any) {
    console.error('Erreur lors de l\'enregistrement:', error)
    toast.error(error.data?.message || 'Erreur lors de l\'enregistrement')
  }
}

watch(movementType, (newType) => {
  selectedProducts.value = selectedProducts.value.map((item) => {
    if (hasVariations(item.product) && item.quantitiesByVariation) {
      const updatedQuantities: Record<string, number> = { ...item.quantitiesByVariation }
      const variations = getProductVariations(item.product)

      variations.forEach((variation) => {
        const key = variation.id.toString()
        if (newType === 'adjustment') {
          updatedQuantities[key] = item.product.stockByVariation?.[key] ?? 0
        } else {
          updatedQuantities[key] = 0
        }
      })

      return {
        ...item,
        quantity: 0,
        currentStock: getTotalStock(item.product),
        quantitiesByVariation: updatedQuantities,
      }
    }

    return {
      ...item,
      quantity: newType === 'adjustment' ? item.currentStock : 0,
    }
  })
})

// Charger au montage
onMounted(async () => {
  await initializeEstablishments()
  await Promise.all([loadCategories(), loadSuppliers(), loadBrands(), loadVariations(), loadCatalogProducts()])
})

watch(selectedEstablishmentId, async () => {
  searchSuggestions.value = []
  await Promise.all([loadCategories(), loadVariations(), loadCatalogProducts()])
})
</script>
