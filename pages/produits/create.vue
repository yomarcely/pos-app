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
            <div class="space-y-2">
              <Label>Catégorie</Label>
              <div class="border rounded-lg p-4 max-h-64 overflow-y-auto">
                <div v-if="categories.length === 0" class="text-center py-4 text-muted-foreground">
                  Aucune catégorie disponible
                </div>
                <div v-else class="space-y-2">
                  <CategoryTreeItem
                    v-for="category in categories"
                    :key="category.id"
                    :category="category"
                    :selected-id="form.categoryId"
                    @select="form.categoryId = $event"
                    @add-subcategory="openAddCategoryDialog"
                  />
                </div>
              </div>
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
            categoryId: form.categoryId
          }"
          :categories="flatCategories"
          @update:form="updatePricingForm"
          @add-category="openAddCategoryDialog"
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
    <Dialog v-model:open="showAddCategoryDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une sous-catégorie</DialogTitle>
          <DialogDescription>Créez une nouvelle sous-catégorie</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="new-category-name">Nom de la catégorie *</Label>
            <Input
              id="new-category-name"
              v-model="newCategoryName"
              placeholder="Ex: T-shirts"
              @keyup.enter="saveNewCategory"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddCategoryDialog = false">Annuler</Button>
          <Button @click="saveNewCategory" :disabled="!newCategoryName.trim()">Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showAddSupplierDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un fournisseur</DialogTitle>
          <DialogDescription>Créez un nouveau fournisseur</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="new-supplier-name">Nom du fournisseur *</Label>
            <Input
              id="new-supplier-name"
              v-model="newSupplierName"
              placeholder="Ex: Acme Corp"
              @keyup.enter="saveNewSupplier"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddSupplierDialog = false">Annuler</Button>
          <Button @click="saveNewSupplier" :disabled="!newSupplierName.trim()">Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showAddBrandDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une marque</DialogTitle>
          <DialogDescription>Créez une nouvelle marque</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="new-brand-name">Nom de la marque *</Label>
            <Input
              id="new-brand-name"
              v-model="newBrandName"
              placeholder="Ex: Nike"
              @keyup.enter="saveNewBrand"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddBrandDialog = false">Annuler</Button>
          <Button @click="saveNewBrand" :disabled="!newBrandName.trim()">Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/composables/useToast'
import ProductFormGeneral from '@/components/produits/form/ProductFormGeneral.vue'
import ProductFormVariations from '@/components/produits/form/ProductFormVariations.vue'
import ProductFormPricing from '@/components/produits/form/ProductFormPricing.vue'
import ProductFormStock from '@/components/produits/form/ProductFormStock.vue'
import ProductFormBarcode from '@/components/produits/form/ProductFormBarcode.vue'
import CategoryTreeItem from '@/components/categories/CategoryTreeItem.vue'

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
const flatCategories = computed(() => {
  const flatten = (cats: any[], level = 0): any[] => {
    let result: any[] = []
    for (const cat of cats) {
      result.push({ id: cat.id, name: '  '.repeat(level) + cat.name })
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flatten(cat.children, level + 1))
      }
    }
    return result
  }
  return flatten(categories.value)
})

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
  form.value.categoryId = updatedForm.categoryId
}

// Dialog actions
function openAddCategoryDialog() {
  newCategoryName.value = ''
  showAddCategoryDialog.value = true
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
    if (response?.success) {
      toast.success('Fournisseur créé avec succès')
      await loadSuppliers()
      form.value.supplierId = response.supplier.id.toString()
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
    if (response?.success) {
      toast.success('Marque créée avec succès')
      await loadBrands()
      form.value.brandId = response.brand.id.toString()
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
    suppliers.value = response.suppliers || []
  } catch (error) {
    console.error('Erreur lors du chargement des fournisseurs:', error)
  }
}

async function loadBrands() {
  try {
    const response: any = await $fetch('/api/brands')
    brands.value = response.brands || []
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

  try {
    const payload = {
      name: form.value.name,
      description: form.value.description || null,
      barcode: form.value.barcode || null,
      price: parseFloat(form.value.price) || 0,
      purchasePrice: form.value.purchasePrice ? parseFloat(form.value.purchasePrice) : null,
      tva: parseFloat(form.value.tva),
      stock: form.value.initialStock,
      stockByVariation: form.value.hasVariations ? form.value.initialStockByVariation : null,
      minStock: form.value.minStock,
      minStockByVariation: form.value.hasVariations ? form.value.minStockByVariation : null,
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
