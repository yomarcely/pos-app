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
            tvaId: form.tvaId,
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
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useProductEditor } from '@/composables/useProductEditor'
import { useProductCatalogData } from '@/composables/useProductCatalogData'
import { useProductStockMovement } from '@/composables/useProductStockMovement'

const route = useRoute()
const router = useRouter()
const activeTab = ref('general')

const productId = computed(() => parseInt(route.params.id as string))

const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

function goBack() {
  router.push('/produits')
}

const {
  originalProduct,
  loading,
  loadingProduct,
  form,
  loadProduct,
  saveProduct: saveProductEditor,
  updateGeneralForm,
  updatePricingForm,
} = useProductEditor(productId, selectedEstablishmentId, goBack)

const {
  suppliers,
  brands,
  categories,
  variationGroups,
  showAddCategoryDialog,
  showAddSupplierDialog,
  showAddBrandDialog,
  newCategoryName,
  newSupplierName,
  newBrandName,
  loadSuppliers,
  loadBrands,
  loadCategories,
  loadVariationGroups,
  openAddSupplierDialog,
  openAddBrandDialog,
  saveNewCategory,
  saveNewSupplier,
  saveNewBrand,
} = useProductCatalogData(selectedEstablishmentId, form)

const selectedGroupId = ref<number | null>(null)

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

const {
  stockDialogOpen,
  movementType,
  movementQuantities,
  historyDialogOpen,
  loadingHistory,
  stockHistory,
  savingMovement,
  getStockByVariation,
  openStockDialog,
  setMovementQuantity,
  submitStockMovement,
  formatDate,
  reasonLabel,
  openHistory,
} = useProductStockMovement(productId, form, selectedVariationsList, originalProduct, loadProduct)

async function saveProduct() {
  await saveProductEditor(originalProduct)
}

// Init
onMounted(async () => {
  await initializeEstablishments()
  await Promise.all([
    loadSuppliers(),
    loadBrands(),
    loadCategories(),
    loadVariationGroups(),
    loadProduct()
  ])
})

watch(selectedEstablishmentId, async () => {
  await Promise.all([loadCategories(), loadVariationGroups(), loadProduct()])
})
</script>
