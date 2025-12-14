<script setup lang="ts">
import { ref, nextTick, inject, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import Toggle from '@/components/ui/toggle/Toggle.vue'
import { RefreshCcw, Trash2 } from 'lucide-vue-next'
import type { Product } from '@/types'
import { storeToRefs } from 'pinia'
import { useProductsStore } from '@/stores/products'
import { useCartStore } from '@/stores/cart'
import { useVariationGroupsStore } from '@/stores/variationGroups'
import ProductSearchWithSuggestions from '@/components/shared/ProductSearchWithSuggestions.vue'

const productsStore = useProductsStore()
const cartStore = useCartStore()
const variationStore = useVariationGroupsStore()

const { products: Products } = storeToRefs(productsStore)
const { items: cart } = storeToRefs(cartStore)
const { groups: variationGroups } = storeToRefs(variationStore)

const bottomRef = ref<HTMLElement | null>(null)
type Suggestion = {
  id: number | string
  name: string
  barcode?: string | null
  image?: string | null
  categoryName?: string | null
  stock?: number | null
  stockByVariation?: Record<string, number | string> | null
  price?: number
  tva?: number
  barcodeByVariation?: Record<string, string>
  variationGroupIds?: Array<number | string>
}

const searchQuery = ref('')
const searchSuggestions = ref<Suggestion[]>([])
const confirmClearOpen = ref(false)
const returnMode = ref(false)
const restockDialogOpen = ref(false)
const pendingProduct = ref<Product | null>(null)
const pendingVariation = ref<string>('')
const pendingRestock = ref(false)

// Injecter l'état des paiements
const hasPayments = inject<Ref<boolean>>('hasPayments', ref(false))
const isCartLocked = computed(() => hasPayments.value)

function scrollToBottom() {
  nextTick(() => {
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

// Fonction pour obtenir le nom d'une variation par son ID
function getVariationNameById(variationId: string | number): string {
  for (const group of variationGroups.value) {
    const variation = group.variations.find(v => v.id === variationId)
    if (variation) {
      return variation.name
    }
  }
  return `Variation ${variationId}`
}

function isProduct(v: unknown): v is Product {
  return typeof v === 'object' && v !== null && 'id' in v && 'name' in v
}

function handleProductAdd(product: Product) {
  const variationName = (() => {
    if (product.variationGroupIds && product.variationGroupIds.length > 0) {
      const firstVariationId = product.variationGroupIds[0]
      if (firstVariationId !== undefined) {
        return getVariationNameById(firstVariationId)
      }
    }
    return ''
  })()

  // Mode retour : quantité négative et flag restock
  if (returnMode.value) {
    const existing = cart.value.find(
      (item) => item.id === product.id && item.variation === variationName
    )
    if (existing) {
      existing.quantity -= 1
      existing.restockOnReturn = pendingRestock.value
    } else {
      cartStore.addToCart(product, variationName)
      const added = cart.value.find(
        (item) => item.id === product.id && item.variation === variationName
      )
      if (added) {
        added.quantity = -1
        added.restockOnReturn = pendingRestock.value
      }
    }
  } else {
    cartStore.addToCart(product, variationName)
  }
  scrollToBottom()
}

function removeFromCart(id: number, variation: string) {
  cartStore.removeFromCart(id, variation)
}

function updateSuggestions() {
  const q = searchQuery.value.trim().toLowerCase()
  if (q.length < 2) {
    searchSuggestions.value = []
    return
  }

  searchSuggestions.value = Products.value.filter((p) => {
    const nameMatch = p.name.toLowerCase().includes(q)
    const barcodeMatch = (p.barcode || '').toLowerCase() === q
    const variationBarcodeMatch = p.barcodeByVariation
      ? Object.values(p.barcodeByVariation).some(b => String(b || '').toLowerCase() === q)
      : false
    return nameMatch || barcodeMatch || variationBarcodeMatch
  }).slice(0, 20)
}

watch(searchQuery, updateSuggestions)

function handleSelectProduct(suggestion: Suggestion) {
  // Find the full product from the store
  const productId = typeof suggestion.id === 'string' ? parseInt(suggestion.id) : suggestion.id
  const product = Products.value.find(p => p.id === productId)

  if (!product) {
    console.error('Product not found:', suggestion.id)
    return
  }

  if (returnMode.value) {
    pendingProduct.value = product
    pendingVariation.value = (() => {
      if (product.variationGroupIds && product.variationGroupIds.length > 0) {
        const firstVariationId = product.variationGroupIds[0]
        if (firstVariationId !== undefined) {
          return getVariationNameById(firstVariationId)
        }
      }
      return ''
    })()
    restockDialogOpen.value = true
  } else {
    handleProductAdd(product)
    searchQuery.value = ''
    searchSuggestions.value = []
  }
}

function selectFirstSuggestion() {
  const firstSuggestion = searchSuggestions.value[0]
  if (firstSuggestion) {
    handleSelectProduct(firstSuggestion)
  }
}

function handleSearchClick() {
  updateSuggestions()
  selectFirstSuggestion()
}

function clearSuggestions() {
  searchSuggestions.value = []
}

function onFocus() {
  updateSuggestions()
}

function openCatalog() {
  // placeholder: catalogue non disponible en caisse pour l'instant
  clearSuggestions()
}

function clearSearch() {
  searchQuery.value = ''
  clearSuggestions()
}

function confirmRestockChoice(restock: boolean) {
  pendingRestock.value = restock
  if (pendingProduct.value) {
    handleProductAdd(pendingProduct.value)
  }
  pendingProduct.value = null
  pendingVariation.value = ''
  searchQuery.value = ''
  searchSuggestions.value = []
  restockDialogOpen.value = false
}

function cancelRestockDialog() {
  pendingProduct.value = null
  pendingVariation.value = ''
  pendingRestock.value = false
  restockDialogOpen.value = false
}

function clearCartAndSearch() {
  cartStore.clearCart()
  clearSearch()
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="w-full flex items-center gap-4 mb-4 justify-between" :class="{ 'opacity-50 pointer-events-none': isCartLocked }">
      <AlertDialog v-model:open="confirmClearOpen">
        <AlertDialogTrigger as-child>
          <Button
            variant="ghost"
            class="h-9 w-9 p-0 border border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
        :disabled="cart.length === 0"
        :class="{ 'opacity-50 cursor-not-allowed': cart.length === 0 }"
      >
        <Trash2 class="w-4 h-4" />
      </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider le panier ?</AlertDialogTitle>
          </AlertDialogHeader>
          <p class="text-sm text-muted-foreground">
            Cette action supprimera tous les produits du panier. Confirmer ?
          </p>
          <AlertDialogFooter class="mt-4">
            <AlertDialogCancel @click="confirmClearOpen = false">Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" @click="clearCartAndSearch(); confirmClearOpen = false">
              Supprimer tout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div class="flex-1 flex justify-center">
        <ProductSearchWithSuggestions
          class="w-full max-w-lg"
          :search-query="searchQuery"
          :suggestions="searchSuggestions"
          :wrap-card="false"
          :show-search-button="false"
          :show-catalog-button="false"
          :show-label="false"
          max-width=""
          :show-extra-controls="false"
          @update:search-query="(v: string) => searchQuery = v"
          @search="handleSearchClick"
          @select-first="selectFirstSuggestion"
          @clear-suggestions="clearSuggestions"
          @focus="onFocus"
          @select-product="handleSelectProduct"
          @open-catalog="openCatalog"
        />
      </div>

      <Toggle
        variant="outline"
        class="h-9 w-9"
        :pressed="returnMode"
        @update:pressed="(v: boolean) => returnMode = v"
      >
        <RefreshCcw class="w-4 h-4" />
      </Toggle>
    </div>

  <!-- Liste des produits du panier -->
  <div class="flex-1 min-h-0">
  <ScrollArea class="h-full w-full rounded-md p-4">
    <div class="flex flex-col gap-2">
      <TransitionGroup tag="div" name="fade-slide" class="flex flex-col gap-2">
        <CaisseCartItem v-for="product in cart" :key="product.id + '-' + product.variation" :product="product"
          @remove="removeFromCart" :is-locked="isCartLocked" />
      </TransitionGroup>
      <!-- 🔻 Élément invisible pour scroll auto -->
      <div ref="bottomRef" />
    </div>
  </ScrollArea>
  </div>

  <!-- Dialog retour produit : remettre en stock ? -->
  <AlertDialog v-model:open="restockDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Retour produit</AlertDialogTitle>
      </AlertDialogHeader>
      <p class="text-sm text-muted-foreground">
        Souhaitez-vous remettre ce produit en stock ?
      </p>
      <AlertDialogFooter class="mt-4">
        <AlertDialogCancel @click="confirmRestockChoice(false)">Non</AlertDialogCancel>
        <AlertDialogAction @click="confirmRestockChoice(true)">Oui, remettre en stock</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  </div>
</template>
