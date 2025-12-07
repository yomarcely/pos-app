<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Nouveau produit</h1>
        <p class="text-muted-foreground mt-1">
          Créez un nouveau produit dans votre catalogue
        </p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="navigateTo('/produits')">
          <X class="w-4 h-4 mr-2" />
          Annuler
        </Button>
        <Button @click="saveProduct">
          <Save class="w-4 h-4 mr-2" />
          Enregistrer
        </Button>
      </div>
    </div>

    <!-- Onglets -->
    <Tabs v-model="activeTab" class="w-full">
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
        >
          <template #category>
            <CategorySelector
              :categories="categories"
              :model-value="form.categoryId"
              @update:model-value="form.categoryId = $event"
            />
          </template>
        </ProductFormGeneral>

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
            tvaId: form.tvaId,
            categoryId: form.categoryId
          }"
          @update:form="updatePricingForm"
        />
      </TabsContent>

      <!-- Onglet 4: Stock -->
      <TabsContent value="stock">
        <ProductFormStock
          :has-variations="form.hasVariations"
          :initial-stock="form.initialStock"
          :min-stock="form.minStock"
          :initial-stock-by-variation="form.initialStockByVariation"
          :min-stock-by-variation="form.minStockByVariation"
          :selected-variations-list="selectedVariationsList"
          @update:initial-stock="form.initialStock = $event"
          @update:min-stock="form.minStock = $event"
          @update:initial-stock-by-variation="form.initialStockByVariation = $event"
          @update:min-stock-by-variation="form.minStockByVariation = $event"
        />
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

import { ref, computed } from 'vue'
import { X, Save } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/composables/useToast'
import FormDialog from '@/components/common/FormDialog.vue'
import ProductFormGeneral from '@/components/produits/form/ProductFormGeneral.vue'
import ProductFormVariations from '@/components/produits/form/ProductFormVariations.vue'
import ProductFormPricing from '@/components/produits/form/ProductFormPricing.vue'
import ProductFormStock from '@/components/produits/form/ProductFormStock.vue'
import ProductFormBarcode from '@/components/produits/form/ProductFormBarcode.vue'
import CategorySelector from '@/components/produits/CategorySelector.vue'

const toast = useToast()
const activeTab = ref('general')

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
  tvaId: null as number | null,
  categoryId: null as string | null,
  hasVariations: false,
  variationGroupIds: [] as number[],
  initialStock: 0,
  minStock: 0,
  initialStockByVariation: {} as Record<number, number>,
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
  form.value.tvaId = updatedForm.tvaId
  form.value.categoryId = updatedForm.categoryId
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
    const response = await $fetch('/api/categories/create', {
      method: 'POST',
      body: { name: newCategoryName.value, parentId: null }
    })
    if (response.success) {
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
    const response = await $fetch('/api/categories')
    categories.value = response.categories || []
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error)
  }
}

async function loadVariationGroups() {
  try {
    const response = await $fetch('/api/variations/groups')
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
    ? Object.fromEntries(selectedVariationIds.map(id => [id, form.value.initialStockByVariation[id] ?? 0]))
    : null
  const minStockByVariation = form.value.hasVariations
    ? Object.fromEntries(selectedVariationIds.map(id => [id, form.value.minStockByVariation[id] ?? 0]))
    : null

  try {
    const payload = {
      name: form.value.name,
      description: form.value.description || null,
      barcode: form.value.barcode || null,
      barcodeByVariation: form.value.hasVariations ? form.value.barcodeByVariation : null,
      supplierCode: form.value.supplierCode || null,
      price: parseFloat(form.value.price) || 0,
      purchasePrice: form.value.purchasePrice ? parseFloat(form.value.purchasePrice) : null,
      tva: parseFloat(form.value.tva),
      tvaId: form.value.tvaId,
      hasVariations: form.value.hasVariations,
      stock: form.value.initialStock,
      stockByVariation,
      minStock: form.value.minStock,
      minStockByVariation,
      variationGroupIds: form.value.hasVariations ? form.value.variationGroupIds : null,
      categoryId: form.value.categoryId ? parseInt(form.value.categoryId) : null,
      supplierId: form.value.supplierId ? parseInt(form.value.supplierId) : null,
      brandId: form.value.brandId ? parseInt(form.value.brandId) : null,
      image: form.value.image,
    }

    const response = await $fetch('/api/products/create', {
      method: 'POST',
      body: payload
    })

    if (response.success) {
      toast.success('Produit créé avec succès')
      navigateTo('/produits')
    }
  } catch (error: any) {
    console.error('Erreur lors de la création du produit:', error)
    toast.error(error.data?.message || 'Erreur lors de la création du produit')
  }
}

// Init
onMounted(async () => {
  await Promise.all([
    loadSuppliers(),
    loadBrands(),
    loadCategories(),
    loadVariationGroups()
  ])
})
</script>
