<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Mouvements de stock</h1>
        <p class="text-muted-foreground mt-1">
          Gérer les entrées, sorties et ajustements de stock
        </p>
      </div>
    </div>

    <!-- Type de mouvement -->
    <Card>
      <CardHeader>
        <CardTitle>Type de mouvement</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-3 gap-4">
          <Button
            :variant="movementType === 'entry' ? 'default' : 'outline'"
            size="lg"
            @click="movementType = 'entry'"
            class="h-20 flex flex-col gap-2"
          >
            <PackagePlus class="w-6 h-6" />
            <span>Entrée / Sortie</span>
          </Button>
          <Button
            :variant="movementType === 'adjustment' ? 'default' : 'outline'"
            size="lg"
            @click="movementType = 'adjustment'"
            class="h-20 flex flex-col gap-2"
          >
            <Settings class="w-6 h-6" />
            <span>Ajustement</span>
          </Button>
          <Button
            :variant="movementType === 'loss' ? 'default' : 'outline'"
            size="lg"
            @click="movementType = 'loss'"
            class="h-20 flex flex-col gap-2"
          >
            <AlertTriangle class="w-6 h-6" />
            <span>Pertes</span>
          </Button>
        </div>
      </CardContent>
    </Card>

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

    <!-- Sélection des produits -->
    <Card>
      <CardHeader>
        <CardTitle>Sélection des produits</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Champ de recherche -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2 relative">
            <Label>Rechercher par nom ou code-barres</Label>
            <div class="flex gap-2 mt-1">
              <div class="relative flex-1">
                <Input
                  v-model="searchQuery"
                  placeholder="Nom du produit ou code-barres..."
                  @input="debouncedSearch"
                  @keydown.enter="selectFirstSuggestion"
                  @keydown.esc="searchSuggestions = []"
                  @focus="handleSearchFocus"
                />

                <!-- Suggestions dropdown -->
                <div
                  v-if="searchSuggestions.length > 0"
                  class="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[300px] overflow-y-auto"
                >
                  <div
                    v-for="product in searchSuggestions"
                    :key="product.id"
                    class="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    @click="selectProductFromSuggestion(product)"
                  >
                    <div v-if="product.image" class="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img :src="product.image" :alt="product.name" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Package class="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium truncate">{{ product.name }}</p>
                      <p class="text-sm text-muted-foreground">{{ product.barcode || 'Sans code-barres' }}</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                      <p class="text-sm font-medium">Stock: {{ getTotalStock(product) }}</p>
                      <p class="text-xs text-muted-foreground">{{ product.categoryName || 'Sans catégorie' }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <Button @click="searchProduct">
                <Search class="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label>&nbsp;</Label>
            <Button variant="outline" class="w-full mt-1" @click="openProductSelector">
              <Package class="w-4 h-4 mr-2" />
              Parcourir le catalogue
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Liste des produits sélectionnés -->
    <Card v-if="selectedProducts.length > 0">
      <CardHeader>
        <CardTitle>Produits sélectionnés ({{ selectedProducts.length }})</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-muted/50 border-b">
              <tr>
                <th class="px-4 py-2 text-left text-sm font-medium">Produit</th>
                <th class="px-4 py-2 text-center text-sm font-medium">Stock actuel</th>
                <th class="px-4 py-2 text-center text-sm font-medium">
                  {{ movementType === 'entry' ? 'Quantité' : movementType === 'adjustment' ? 'Nouveau stock' : 'Perte' }}
                </th>
                <th class="px-4 py-2 text-center text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <template v-for="item in selectedProducts" :key="item.product.id">
                <!-- Produit sans variation -->
                <tr v-if="!hasVariations(item.product)" class="hover:bg-muted/50">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div v-if="item.product.image" class="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                        <img :src="item.product.image" :alt="item.product.name" class="w-full h-full object-cover" />
                      </div>
                      <div v-else class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package class="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p class="font-medium">{{ item.product.name }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span class="px-2 py-1 rounded-full text-xs font-medium bg-muted">
                      {{ item.currentStock }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <Input
                      v-model.number="item.quantity"
                      type="number"
                      :min="movementType === 'loss' ? 1 : undefined"
                      class="w-24 mx-auto text-center"
                    />
                  </td>
                  <td class="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" @click="removeProduct(item.product.id)">
                      <Trash2 class="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>

                <!-- Produit avec variations -->
                <template v-else>
                  <!-- Ligne principale du produit -->
                  <tr class="bg-muted/30">
                    <td class="px-4 py-3" colspan="3">
                      <div class="flex items-center gap-3">
                        <div v-if="item.product.image" class="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                          <img :src="item.product.image" :alt="item.product.name" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Package class="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p class="font-medium">{{ item.product.name }}</p>
                          <p class="text-xs text-muted-foreground">Produit avec variations</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" @click="removeProduct(item.product.id)">
                        <Trash2 class="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>

                  <!-- Lignes des variations -->
                  <tr
                    v-for="variation in getProductVariations(item.product)"
                    :key="`${item.product.id}-${variation.id}`"
                    class="hover:bg-muted/50"
                  >
                    <td class="px-4 py-3 pl-16">
                      <p class="text-sm">{{ variation.name }}</p>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="px-2 py-1 rounded-full text-xs font-medium bg-muted">
                        {{ item.product.stockByVariation?.[variation.id.toString()] ?? 0 }}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <Input
                        v-model.number="item.quantitiesByVariation![variation.id.toString()]"
                        type="number"
                        :min="movementType === 'loss' ? 1 : undefined"
                        class="w-24 mx-auto text-center"
                      />
                    </td>
                    <td class="px-4 py-3 text-center">
                      <!-- Espace vide pour aligner avec le bouton supprimer du produit -->
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Boutons d'action -->
        <div class="flex justify-end gap-2 mt-4">
          <Button variant="outline" @click="clearAll">
            Annuler
          </Button>
          <Button @click="validateMovement" :disabled="selectedProducts.length === 0">
            Valider le mouvement
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Dialog sélecteur de produits -->
    <Dialog v-model:open="isProductSelectorOpen">
      <DialogContent class="w-[1100px] max-w-[1100px] h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sélectionner un produit</DialogTitle>
        </DialogHeader>

        <!-- Filtres -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
          <div>
            <Label>Recherche</Label>
            <Input
              v-model="catalogSearchQuery"
              placeholder="Nom ou code-barres..."
              @input="debouncedCatalogSearch"
            />
          </div>
          <div>
            <Label>Catégorie</Label>
            <select
              v-model="selectedCategoryFilter"
              class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              @change="loadCatalogProducts"
            >
              <option :value="null">Toutes les catégories</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </div>
          <div>
            <Label>Fournisseur</Label>
            <select
              v-model="selectedSupplierFilter"
              class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              @change="loadCatalogProducts"
            >
              <option :value="null">Tous les fournisseurs</option>
              <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                {{ supplier.name }}
              </option>
            </select>
          </div>
          <div>
            <Label>Marque</Label>
            <select
              v-model="selectedBrandFilter"
              class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              @change="loadCatalogProducts"
            >
              <option :value="null">Toutes les marques</option>
              <option v-for="brand in brands" :key="brand.id" :value="brand.id">
                {{ brand.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Liste des produits -->
        <div class="border rounded-lg overflow-hidden flex flex-col h-[calc(80vh-220px)]">
          <div v-if="loadingCatalog" class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>

          <div v-else class="flex-1 overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-4 py-2 text-left w-14">Image</th>
                  <th class="px-4 py-2 text-left">Produit</th>
                  <th class="px-4 py-2 text-center w-24">Stock</th>
                  <th class="px-4 py-2 text-left">Catégorie</th>
                  <th class="px-4 py-2 text-left">Fournisseur</th>
                  <th class="px-4 py-2 text-left">Marque</th>
                  <th class="px-4 py-2 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="catalogProducts.length === 0">
                  <td colspan="7" class="px-4 py-6 text-center text-muted-foreground">
                    Aucun produit trouvé
                  </td>
                </tr>
                <tr
                  v-for="product in catalogProducts"
                  :key="product.id"
                  class="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                  @click="addProductFromCatalog(product)"
                >
                  <td class="px-4 py-3">
                    <div v-if="product.image" class="w-12 h-12 rounded-md overflow-hidden bg-muted">
                      <img :src="product.image" :alt="product.name" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                      <Package class="w-5 h-5 text-muted-foreground" />
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <p class="font-medium">{{ product.name }}</p>
                    <p v-if="product.barcode" class="text-xs text-muted-foreground">CB: {{ product.barcode }}</p>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span class="px-2 py-1 rounded-full text-xs font-medium bg-muted">
                      {{ getTotalStock(product) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-muted-foreground">
                    {{ product.categoryName || '—' }}
                  </td>
                  <td class="px-4 py-3 text-sm text-muted-foreground">
                    {{ product.supplierName || '—' }}
                  </td>
                  <td class="px-4 py-3 text-sm text-muted-foreground">
                    {{ product.brandName || '—' }}
                  </td>
                  <td class="px-4 py-3 text-center" @click.stop>
                    <Button size="sm" variant="outline" @click="addProductFromCatalog(product)">
                      Ajouter
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isProductSelectorOpen = false">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  PackagePlus,
  Settings,
  AlertTriangle,
  Search,
  Package,
  Trash2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/composables/useToast'

definePageMeta({
  layout: 'dashboard'
})

const toast = useToast()

interface Product {
  id: number
  name: string
  barcode: string
  categoryId: number | null
  categoryName: string | null
  supplierId: number | null
  supplierName?: string | null
  brandId: number | null
  brandName?: string | null
  price: number
  purchasePrice?: number
  stock: number
  stockByVariation?: Record<string, number>
  variationGroupIds?: Array<number | string>
  image: string | null
}

interface SelectedProduct {
  product: Product
  variation?: string
  currentStock: number
  quantity: number
  quantitiesByVariation?: Record<string, number>
}

interface Variation {
  id: number | string
  name: string
}

interface Category {
  id: number
  name: string
}

interface Supplier {
  id: number
  name: string
}

interface Brand {
  id: number
  name: string
}

// State
const movementType = ref<'entry' | 'adjustment' | 'loss'>('entry')
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

// Debounced search for suggestions
let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.trim().length < 2) {
      searchSuggestions.value = []
      return
    }

    try {
      const response = await $fetch('/api/products', {
        params: { search: searchQuery.value.trim() }
      })
      searchSuggestions.value = (response.products as any[]).map(normalizeProduct)
    } catch (error) {
      console.error('Erreur lors de la recherche:', error)
    }
  }, 300)
}

// Debounced search for catalog
const debouncedCatalogSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadCatalogProducts()
  }, 300)
}

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

    if (products.length === 1) {
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
    const response = await $fetch('/api/categories')

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
    const response = await $fetch('/api/suppliers')
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
    const response = await $fetch('/api/variations')
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

// Helper function
function getTotalStock(product: Product): number {
  if (product.stockByVariation && Object.keys(product.stockByVariation).length > 0) {
    return Object.values(product.stockByVariation).reduce((sum, qty) => sum + Number(qty || 0), 0)
  }
  return product.stock || 0
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
  await Promise.all([loadCategories(), loadSuppliers(), loadBrands(), loadVariations()])
})
</script>
