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
            categoryId: form.categoryId
          }"
          @update:form="updatePricingForm"
        />
      </TabsContent>

      <!-- Onglet 4: Stock -->
      <TabsContent value="stock">
        <Card>
          <CardHeader class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Gestion du stock</CardTitle>
                <CardDescription>
                  Gérez le stock depuis cette fiche produit.
                </CardDescription>
              </div>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" @click="openHistory">
                  Historique
                </Button>
                <Button size="sm" @click="openStockDialog('reception')">
                  Mouvement de stock
                </Button>
              </div>
            </div>
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

    <!-- Dialog: Mouvement de stock -->
    <Dialog v-model:open="stockDialogOpen">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ movementType === 'reception' ? 'Entrée de stock' : 'Ajustement de stock' }}
          </DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Type</Label>
            <div class="flex gap-2">
              <Button
                :variant="movementType === 'reception' ? 'default' : 'outline'"
                type="button"
                @click="movementType = 'reception'"
              >
                Entrée
              </Button>
              <Button
                :variant="movementType === 'adjustment' ? 'default' : 'outline'"
                type="button"
                @click="movementType = 'adjustment'"
              >
                Ajustement
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              Entrée ajoute une quantité. Ajustement fixe un nouveau stock.
            </p>
          </div>

          <div v-if="form.hasVariations" class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium">Variations</p>
              <p class="text-xs text-muted-foreground">Stock actuel et nouvelle valeur</p>
            </div>
            <div
              v-for="variation in selectedVariationsList"
              :key="variation.id"
              class="flex items-center gap-3"
            >
              <div class="flex-1 space-y-1">
                <p class="text-sm font-medium">{{ variation.name }}</p>
                <div class="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Stock actuel</span>
                  <span class="text-lg font-semibold">{{ getStockByVariation(variation.id) }}</span>
                </div>
              </div>
              <Input
                type="number"
                min="0"
                class="w-32"
                :model-value="movementQuantities[variation.id]?.toString() ?? ''"
                @update:model-value="(val) => setMovementQuantity(variation.id, val)"
              />
            </div>
          </div>

          <div v-else class="space-y-2">
            <Label>Nouveau stock / quantité</Label>
            <div class="rounded-lg border bg-muted/50 px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Stock actuel</p>
                <p class="text-3xl font-semibold">{{ originalProduct?.stock || 0 }}</p>
              </div>
              <div class="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  class="w-32"
                  :model-value="movementQuantities['base']?.toString() ?? ''"
                  @update:model-value="(val) => setMovementQuantity('base', val)"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="outline" type="button" @click="stockDialogOpen = false">
            Annuler
          </Button>
          <Button :disabled="savingMovement" type="button" @click="submitStockMovement">
            {{ savingMovement ? 'En cours...' : 'Valider' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Historique de stock -->
    <Dialog v-model:open="historyDialogOpen">
      <DialogContent class="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Historique de stock</DialogTitle>
        </DialogHeader>
        <div class="max-h-[420px] overflow-y-auto space-y-3">
          <LoadingSpinner v-if="loadingHistory" text="Chargement de l'historique..." />
          <div v-else-if="stockHistory.length === 0" class="text-sm text-muted-foreground">
            Aucun mouvement de stock pour ce produit.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="movement in stockHistory"
              :key="movement.id"
              class="border rounded-lg p-3 space-y-1"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Badge variant="secondary">{{ reasonLabel(movement.reason) }}</Badge>
                  <span class="text-sm font-medium">
                    {{ movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity }}
                  </span>
                  <span v-if="movement.variation" class="text-xs text-muted-foreground">
                    Variation: {{ movement.variation }}
                  </span>
                  <span v-if="movement.reason === 'sale' && movement.saleTicket" class="text-xs text-muted-foreground">
                    Ticket #{{ movement.saleTicket }}
                  </span>
                </div>
                <span class="text-xs text-muted-foreground">
                  {{ formatDate(movement.createdAt) }}
                </span>
              </div>
              <div class="text-xs text-muted-foreground">
                Stock: {{ movement.previousStock }} → {{ movement.newStock }}
                <span v-if="movement.movementNumber"> · Mouvement #{{ movement.movementNumber }}</span>
              </div>
              <div v-if="movement.movementComment" class="text-xs text-muted-foreground">
                {{ movement.movementComment }}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const activeTab = ref('general')
const loading = ref(false)
const loadingProduct = ref(true)
const savingMovement = ref(false)

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

// Stock movements
const stockDialogOpen = ref(false)
const movementType = ref<'reception' | 'adjustment'>('reception')
const movementQuantities = ref<Record<string | number, number | null>>({})
const historyDialogOpen = ref(false)
const loadingHistory = ref(false)
const stockHistory = ref<any[]>([])

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

function resetMovementQuantities() {
  if (form.value.hasVariations) {
    const quantities: Record<string | number, number | null> = {}
    for (const variation of selectedVariationsList.value) {
      quantities[variation.id] = null
    }
    movementQuantities.value = quantities
  } else {
    movementQuantities.value = { base: null }
  }
}

function openStockDialog(type: 'reception' | 'adjustment') {
  movementType.value = type
  resetMovementQuantities()
  stockDialogOpen.value = true
}

function setMovementQuantity(key: string | number, value: string | number) {
  const parsed = Number(value)
  movementQuantities.value = {
    ...movementQuantities.value,
    [key]: Number.isFinite(parsed) ? parsed : null,
  }
}

async function submitStockMovement() {
  const items: any[] = []
  const adjustmentType = movementType.value === 'reception' ? 'add' : 'set'

  if (form.value.hasVariations) {
    for (const variation of selectedVariationsList.value) {
      const qty = movementQuantities.value[variation.id]
      if (qty === null || qty === undefined || !Number.isFinite(qty)) continue
      items.push({
        productId: productId.value,
        variation: variation.id.toString(),
        quantity: Number(qty),
        adjustmentType,
      })
    }
  } else {
    const qty = movementQuantities.value['base']
    if (qty !== null && qty !== undefined && Number.isFinite(qty)) {
      items.push({
        productId: productId.value,
        quantity: Number(qty),
        adjustmentType,
      })
    }
  }

  if (!items.length) {
    toast.error('Renseignez au moins une quantité')
    return
  }

  savingMovement.value = true
  try {
    await $fetch('/api/movements/create', {
      method: 'POST',
      body: {
        type: movementType.value,
        items,
      },
    })
    toast.success('Mouvement enregistré')
    stockDialogOpen.value = false
    await loadProduct()
  } catch (error: any) {
    console.error('Erreur lors du mouvement de stock:', error)
    toast.error(error.data?.message || 'Erreur lors du mouvement de stock')
  } finally {
    savingMovement.value = false
  }
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleString('fr-FR')
}

function reasonLabel(reason: string) {
  const map: Record<string, string> = {
    reception: 'Entrée',
    inventory_adjustment: 'Ajustement',
    loss: 'Perte',
    transfer: 'Transfert',
  }
  return map[reason] || reason
}

async function openHistory() {
  historyDialogOpen.value = true
  if (stockHistory.value.length) return
  await loadHistory()
}

async function loadHistory() {
  try {
    loadingHistory.value = true
    const response: any = await $fetch(`/api/products/${productId.value}/stock-history`)
    stockHistory.value = response.movements || []
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error)
    toast.error('Erreur lors du chargement de l\'historique')
  } finally {
    loadingHistory.value = false
  }
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
      barcodeByVariation: form.value.hasVariations ? form.value.barcodeByVariation : null,
      supplierCode: form.value.supplierCode || null,
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
