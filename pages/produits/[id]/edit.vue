<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="goBack">
          <ArrowLeft class="w-5 h-5" />
        </Button>
        <div>
          <h1 class="text-3xl font-bold">Modifier le produit</h1>
          <p class="text-muted-foreground mt-1">
            Modifiez les informations de ce produit
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="goBack">
          <X class="w-4 h-4 mr-2" />
          Annuler
        </Button>
        <Button @click="saveProduct" :disabled="loading">
          <Save class="w-4 h-4 mr-2" />
          {{ loading ? 'Enregistrement...' : 'Enregistrer' }}
        </Button>
      </div>
    </div>

    <!-- Loading state -->
    <LoadingSpinner v-if="loadingProduct" text="Chargement du produit..." />

    <!-- Onglets -->
    <Tabs v-else v-model="activeTab" class="w-full">
      <TabsList class="!flex w-full h-auto">
        <TabsTrigger value="general">Général</TabsTrigger>
        <TabsTrigger value="variations">Variations</TabsTrigger>
        <TabsTrigger value="prix">Prix</TabsTrigger>
        <TabsTrigger value="stock">Stock</TabsTrigger>
        <TabsTrigger value="barcode">Code-barres</TabsTrigger>
      </TabsList>

      <!-- Onglet 1: Général -->
      <TabsContent value="general">
        <ProductFormGeneral
          :form="{
            name: form.name,
            description: form.description,
            supplierId: form.supplierId,
            brandId: form.brandId,
            image: form.image
          }"
          :suppliers="suppliers"
          :brands="brands"
          @update:form="updateGeneralForm"
          @add-supplier="openAddSupplierDialog"
          @add-brand="openAddBrandDialog"
        />

        <!-- Switch variations + Catégorie -->
        <Card class="mt-6">
          <CardContent class="p-6 space-y-6">
            <!-- Switch variations -->
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label>Gérer les variations</Label>
                <p class="text-sm text-muted-foreground">
                  Activer les variations de produit (taille, couleur...)
                </p>
              </div>
              <Switch v-model="form.hasVariations" />
            </div>

            <!-- Catégorie -->
            <CategorySelector
              :categories="categories"
              :model-value="form.categoryId"
              @update:model-value="form.categoryId = $event"
            />
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Onglet 2: Variations -->
      <TabsContent value="variations">
        <ProductFormVariations
          :has-variations="form.hasVariations"
          :variation-groups="variationGroups"
          :selected-group-id="selectedGroupId"
          :selected-variations-ids="form.variationGroupIds"
          @update:selected-group-id="selectedGroupId = $event"
          @update:selected-variations-ids="form.variationGroupIds = $event"
        />
      </TabsContent>

      <!-- Onglet 3: Prix -->
      <TabsContent value="prix">
        <ProductFormPricing
          :form="{
            price: form.price,
            purchasePrice: form.purchasePrice,
            tva: form.tva,
            categoryId: form.categoryId
          }"
          @update:form="updatePricingForm"
        />
      </TabsContent>

      <!-- Onglet 4: Stock -->
      <TabsContent value="stock">
        <Card>
          <CardHeader>
            <CardTitle>Gestion du stock</CardTitle>
            <CardDescription>
              Le stock actuel ne peut pas être modifié directement ici. Utilisez les mouvements de stock.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Stock actuel (lecture seule) -->
            <div v-if="!form.hasVariations">
              <div class="space-y-2">
                <Label>Stock actuel</Label>
                <div class="p-3 bg-muted rounded-lg">
                  <p class="text-2xl font-bold">{{ originalProduct?.stock || 0 }}</p>
                  <p class="text-xs text-muted-foreground mt-1">
                    Utilisez la page "Mouvements" pour modifier le stock
                  </p>
                </div>
              </div>

              <!-- Stock minimum -->
              <div class="space-y-2 mt-4">
                <Label for="min-stock">Stock minimum (alerte)</Label>
                <Input
                  id="min-stock"
                  v-model.number="form.minStock"
                  type="number"
                  min="0"
                  placeholder="5"
                />
                <p class="text-xs text-muted-foreground">
                  Vous serez alerté lorsque le stock descendra en dessous de ce seuil
                </p>
              </div>
            </div>

            <div v-else>
              <!-- Stock par variation (lecture seule) -->
              <div v-if="selectedVariationsList.length === 0" class="text-center py-8 text-muted-foreground">
                <Info class="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune variation sélectionnée.</p>
              </div>

              <div v-else class="space-y-4">
                <p class="text-sm text-muted-foreground">
                  Stock actuel par variation (lecture seule)
                </p>
                <div v-for="variation in selectedVariationsList" :key="variation.id" class="border rounded-lg p-4 space-y-3">
                  <h4 class="font-medium">{{ variation.name }}</h4>
                  <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                      <Label>Stock actuel</Label>
                      <div class="p-3 bg-muted rounded-lg">
                        <p class="text-xl font-bold">{{ getStockByVariation(variation.id) }}</p>
                      </div>
                    </div>
                    <div class="space-y-2">
                      <Label :for="`min-stock-${variation.id}`">Stock minimum</Label>
                      <Input
                        :id="`min-stock-${variation.id}`"
                        v-model.number="form.minStockByVariation[variation.id]"
                        type="number"
                        min="0"
                        placeholder="5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Onglet 5: Code-barres -->
      <TabsContent value="barcode">
        <ProductFormBarcode
          :has-variations="form.hasVariations"
          :supplier-code="form.supplierCode"
          :barcode="form.barcode"
          :barcode-by-variation="form.barcodeByVariation"
          :selected-variations-list="selectedVariationsList"
          @update:supplier-code="form.supplierCode = $event"
          @update:barcode="form.barcode = $event"
          @update:barcode-by-variation="form.barcodeByVariation = $event"
        />
      </TabsContent>
    </Tabs>

    <!-- Dialogs -->
    <FormDialog
      v-model:open="showAddCategoryDialog"
      v-model="newCategoryName"
      title="Ajouter une sous-catégorie"
      description="Créez une nouvelle sous-catégorie"
      label="Nom de la catégorie"
      placeholder="Ex: T-shirts"
      submit-label="Créer"
      @submit="saveNewCategory"
    />

    <FormDialog
      v-model:open="showAddSupplierDialog"
      v-model="newSupplierName"
      title="Ajouter un fournisseur"
      description="Créez un nouveau fournisseur"
      label="Nom du fournisseur"
      placeholder="Ex: Acme Corp"
      submit-label="Créer"
      @submit="saveNewSupplier"
    />

    <FormDialog
      v-model:open="showAddBrandDialog"
      v-model="newBrandName"
      title="Ajouter une marque"
      description="Créez une nouvelle marque"
      label="Nom de la marque"
      placeholder="Ex: Nike"
      submit-label="Créer"
      @submit="saveNewBrand"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, computed, watch } from 'vue'
import { ArrowLeft, X, Save, Info } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/composables/useToast'
import { useRoute, useRouter } from 'vue-router'
import FormDialog from '@/components/common/FormDialog.vue'
import ProductFormGeneral from '@/components/produits/form/ProductFormGeneral.vue'
import ProductFormVariations from '@/components/produits/form/ProductFormVariations.vue'
import ProductFormPricing from '@/components/produits/form/ProductFormPricing.vue'
import ProductFormBarcode from '@/components/produits/form/ProductFormBarcode.vue'
import CategorySelector from '@/components/produits/CategorySelector.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const activeTab = ref('general')
const loading = ref(false)
const loadingProduct = ref(true)

const productId = computed(() => parseInt(route.params.id as string))

// Original product data
const originalProduct = ref<any>(null)

// Form data
const form = ref({
  name: '',
  description: '',
  supplierId: null as string | null,
  brandId: null as string | null,
  image: null as string | null,
  price: '',
  purchasePrice: '',
  tva: '20',
  categoryId: null as string | null,
  hasVariations: false,
  variationGroupIds: [] as number[],
  minStock: 0,
  minStockByVariation: {} as Record<number, number>,
  supplierCode: '',
  barcode: '',
  barcodeByVariation: {} as Record<number, string>,
})

// Data
const suppliers = ref<any[]>([])
const brands = ref<any[]>([])
const categories = ref<any[]>([])
const variationGroups = ref<any[]>([])
const selectedGroupId = ref<number | null>(null)

// Dialogs
const showAddCategoryDialog = ref(false)
const showAddSupplierDialog = ref(false)
const showAddBrandDialog = ref(false)
const newCategoryName = ref('')
const newSupplierName = ref('')
const newBrandName = ref('')

// Computed
const selectedVariationsList = computed(() => {
  const variations: any[] = []
  for (const group of variationGroups.value) {
    for (const variation of group.variations) {
      if (form.value.variationGroupIds.includes(variation.id)) {
        variations.push(variation)
      }
    }
  }
  return variations
})

// Pré-sélectionner le groupe correspondant aux variations chargées
function ensureSelectedGroupFromVariations() {
  if (selectedGroupId.value) return
  if (!form.value.variationGroupIds.length) return
  const group = variationGroups.value.find((g: any) =>
    g.variations?.some((v: any) => form.value.variationGroupIds.includes(v.id))
  )
  if (group) {
    selectedGroupId.value = group.id
  }
}

watch(
  [variationGroups, () => form.value.variationGroupIds],
  ensureSelectedGroupFromVariations,
  { immediate: true }
)

// Update handlers
function updateGeneralForm(updatedForm: any) {
  form.value.name = updatedForm.name
  form.value.description = updatedForm.description
  form.value.supplierId = updatedForm.supplierId
  form.value.brandId = updatedForm.brandId
  form.value.image = updatedForm.image
}

function updatePricingForm(updatedForm: any) {
  form.value.price = updatedForm.price
  form.value.purchasePrice = updatedForm.purchasePrice
  form.value.tva = updatedForm.tva
  form.value.categoryId = updatedForm.categoryId
}

function getStockByVariation(variationId: number): number {
  if (!originalProduct.value?.stockByVariation) return 0
  return originalProduct.value.stockByVariation[variationId] || 0
}

// Navigation
function goBack() {
  router.push('/produits')
}

function openAddSupplierDialog() {
  newSupplierName.value = ''
  showAddSupplierDialog.value = true
}

function openAddBrandDialog() {
  newBrandName.value = ''
  showAddBrandDialog.value = true
}

async function saveNewCategory() {
  if (!newCategoryName.value.trim()) return
  try {
    const response: any = await $fetch('/api/categories/create', {
      method: 'POST',
      body: { name: newCategoryName.value, parentId: null }
    })
    if (response?.success) {
      toast.success('Catégorie créée avec succès')
      await loadCategories()
      showAddCategoryDialog.value = false
    }
  } catch (error: any) {
    toast.error(error.data?.message || 'Erreur lors de la création')
  }
}

async function saveNewSupplier() {
  if (!newSupplierName.value.trim()) return
  try {
    const response: any = await $fetch('/api/suppliers/create', {
      method: 'POST',
      body: { name: newSupplierName.value }
    })
    const created = response?.supplier || response
    if (created?.id) {
      toast.success('Fournisseur créé avec succès')
      await loadSuppliers()
      form.value.supplierId = created.id.toString()
      showAddSupplierDialog.value = false
    }
  } catch (error: any) {
    toast.error(error.data?.message || 'Erreur lors de la création')
  }
}

async function saveNewBrand() {
  if (!newBrandName.value.trim()) return
  try {
    const response: any = await $fetch('/api/brands/create', {
      method: 'POST',
      body: { name: newBrandName.value }
    })
    const created = response?.brand || response
    if (created?.id) {
      toast.success('Marque créée avec succès')
      await loadBrands()
      form.value.brandId = created.id.toString()
      showAddBrandDialog.value = false
    }
  } catch (error: any) {
    toast.error(error.data?.message || 'Erreur lors de la création')
  }
}

// Load data
async function loadProduct() {
  try {
    loadingProduct.value = true
    const response = await $fetch(`/api/products/${productId.value}`)

    if (response.success && response.product) {
      originalProduct.value = response.product
      const product = response.product

      // Populate form
      form.value.name = product.name || ''
      form.value.description = product.description || ''
      form.value.supplierId = product.supplierId ? product.supplierId.toString() : null
      form.value.brandId = product.brandId ? product.brandId.toString() : null
      form.value.image = product.image || null
      form.value.price = product.price?.toString() || ''
      form.value.purchasePrice = product.purchasePrice?.toString() || ''
      form.value.tva = product.tva?.toString() || '20'
      form.value.categoryId = product.categoryId ? product.categoryId.toString() : null
      form.value.hasVariations = !!product.variationGroupIds && product.variationGroupIds.length > 0
      form.value.variationGroupIds = product.variationGroupIds || []
      form.value.minStock = product.minStock || 0
      form.value.minStockByVariation = product.minStockByVariation || {}
      form.value.supplierCode = product.supplierCode || ''
      form.value.barcode = product.barcode || ''
      form.value.barcodeByVariation = product.barcodeByVariation || {}
    }
  } catch (error) {
    console.error('Erreur lors du chargement du produit:', error)
    toast.error('Erreur lors du chargement du produit')
    goBack()
  } finally {
    loadingProduct.value = false
  }
}

async function loadSuppliers() {
  try {
    const response: any = await $fetch('/api/suppliers')
    suppliers.value = Array.isArray(response) ? response : (response.suppliers || [])
  } catch (error) {
    console.error('Erreur lors du chargement des fournisseurs:', error)
  }
}

async function loadBrands() {
  try {
    const response: any = await $fetch('/api/brands')
    brands.value = Array.isArray(response) ? response : (response.brands || [])
  } catch (error) {
    console.error('Erreur lors du chargement des marques:', error)
  }
}

async function loadCategories() {
  try {
    const response: any = await $fetch('/api/categories')
    categories.value = response.categories || []
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error)
  }
}

async function loadVariationGroups() {
  try {
    const response: any = await $fetch('/api/variations/groups')
    variationGroups.value = response.groups || []
  } catch (error) {
    console.error('Erreur lors du chargement des variations:', error)
  }
}

// Save product
async function saveProduct() {
  if (!form.value.name.trim()) {
    toast.error('Le nom du produit est obligatoire')
    return
  }

  // Validation variations
  if (form.value.hasVariations && (!form.value.variationGroupIds || form.value.variationGroupIds.length === 0)) {
    toast.error('Sélectionnez au moins une variation')
    return
  }

  const selectedVariationIds = form.value.hasVariations ? form.value.variationGroupIds : []
  const stockByVariation = form.value.hasVariations
    ? Object.fromEntries(selectedVariationIds.map(id => [id, originalProduct.value?.stockByVariation?.[id] ?? 0]))
    : null
  const minStockByVariation = form.value.hasVariations
    ? Object.fromEntries(selectedVariationIds.map(id => [id, form.value.minStockByVariation[id] ?? 0]))
    : null

  loading.value = true
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description || null,
      barcode: form.value.barcode || null,
      price: parseFloat(form.value.price) || 0,
      purchasePrice: form.value.purchasePrice ? parseFloat(form.value.purchasePrice) : null,
      tva: parseFloat(form.value.tva),
      hasVariations: form.value.hasVariations,
      minStock: form.value.minStock,
      minStockByVariation,
      stockByVariation,
      variationGroupIds: form.value.hasVariations ? form.value.variationGroupIds : null,
      categoryId: form.value.categoryId ? parseInt(form.value.categoryId) : null,
      supplierId: form.value.supplierId ? parseInt(form.value.supplierId) : null,
      brandId: form.value.brandId ? parseInt(form.value.brandId) : null,
      image: form.value.image,
    }

    const response: any = await $fetch(`/api/products/${productId.value}`, {
      method: 'PUT',
      body: payload
    })

    if (response?.success) {
      toast.success('Produit mis à jour avec succès')
      goBack()
    }
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour du produit:', error)
    toast.error(error.data?.message || 'Erreur lors de la mise à jour du produit')
  } finally {
    loading.value = false
  }
}

// Init
onMounted(async () => {
  await Promise.all([
    loadSuppliers(),
    loadBrands(),
    loadCategories(),
    loadVariationGroups(),
    loadProduct()
  ])
})
</script>
