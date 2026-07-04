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
import { Checkbox } from '@/components/ui/checkbox'
import { RefreshCcw, Trash2 } from 'lucide-vue-next'
import type { Product } from '@/types'
import type { ProductInCart } from '@/types/pos'
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
// Dialog unique de confirmation de retour (remplace l'ancien dialog par article)
const returnConfirmOpen = ref(false)

// Lignes retournées présentes dans le panier (quantité négative)
const returnedItems = computed(() =>
  cart.value.filter(item => item.quantity < 0) as ProductInCart[]
)

// Checkbox d'en-tête « Tout remettre en stock »
const allRestock = computed<boolean>({
  get: () => returnedItems.value.length > 0 && returnedItems.value.every(item => item.restockOnReturn),
  set: (value: boolean) => {
    returnedItems.value.forEach((item) => { item.restockOnReturn = value })
  },
})

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
  const targetNum = Number(variationId)
  for (const group of variationGroups.value) {
    const variation = group.variations.find(v => Number(v.id) === targetNum)
    if (variation) {
      return variation.name
    }
  }
  return ''
}

function isProduct(v: unknown): v is Product {
  return typeof v === 'object' && v !== null && 'id' in v && 'name' in v
}

function handleProductAdd(product: Product) {
  // Variation par défaut : la première du produit. On porte l'ID ET le nom
  // (l'ID est la clé de stock côté serveur ; le nom sert à l'affichage).
  const { variationName, variationId } = (() => {
    if (product.variationGroupIds && product.variationGroupIds.length > 0) {
      const firstVariationId = product.variationGroupIds[0]
      if (firstVariationId !== undefined) {
        const name = getVariationNameById(firstVariationId)
        if (name) return { variationName: name, variationId: Number(firstVariationId) }
      }
    }
    return { variationName: '', variationId: null }
  })()

  // Mode retour : quantité négative, remise en stock cochée par défaut.
  // Le choix de remise en stock se fait dans le dialog de confirmation unique.
  if (returnMode.value) {
    // Chercher une ligne existante avec quantité négative
    const existing = cart.value.find(
      (item) => item.id === product.id && item.variation === variationName && item.quantity < 0
    )
    if (existing) {
      existing.quantity -= 1
    } else {
      // Ajouter manuellement dans le panier avec quantité -1
      cart.value.push({
        ...product,
        quantity: -1,
        discount: 0,
        discountType: '%',
        variation: variationName,
        variationId,
        restockOnReturn: true,
        _uniqueId: Date.now() + Math.random(), // ID unique pour différencier les lignes
      } as ProductInCart)
    }
  } else {
    cartStore.addToCart(product, variationName, variationId)
  }
  scrollToBottom()
}

function removeFromCartByIndex(index: number) {
  cart.value.splice(index, 1)
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

  // En mode retour comme en mode normal, on ajoute directement la ligne au panier.
  // En mode retour, la confirmation (et le choix de remise en stock) se fait via
  // le dialog unique « Confirmer le retour ».
  handleProductAdd(product)
  searchQuery.value = ''
  searchSuggestions.value = []
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

function openReturnConfirm() {
  if (returnedItems.value.length === 0) return
  returnConfirmOpen.value = true
}

function confirmReturn() {
  // Les flags restockOnReturn sont déjà positionnés sur les items via les checkboxes.
  returnConfirmOpen.value = false
  returnMode.value = false // Sortir du mode retour une fois le retour confirmé
}

function cancelReturnConfirm() {
  returnConfirmOpen.value = false
}

function clearCartAndSearch() {
  cartStore.clearCart()
  clearSearch()
}

// ===========================================
// Raccourcis clavier (useCaisseShortcuts, monté sur la page) :
// la page tient un ref sur ce composant et appelle ces deux méthodes.
// ===========================================
const searchRef = ref<{ focus: () => void } | null>(null)

function focusSearch() {
  searchRef.value?.focus()
}

/** Retire la dernière ligne du panier (Suppr). No-op si panier verrouillé ou vide. */
function removeLastItem() {
  if (isCartLocked.value || cart.value.length === 0) return
  cart.value.splice(cart.value.length - 1, 1)
}

defineExpose({ focusSearch, removeLastItem })
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
          ref="searchRef"
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

      <div class="flex items-center gap-2">
        <Button
          v-if="returnMode && returnedItems.length > 0"
          variant="outline"
          class="h-9 border-orange-500 text-orange-700 hover:bg-orange-50"
          @click="openReturnConfirm"
        >
          Confirmer le retour ({{ returnedItems.length }})
        </Button>
        <Button
          variant="outline"
          size="icon"
          :class="[
            'h-9 w-9 transition-colors',
            returnMode ? 'bg-orange-100 border-orange-500 text-orange-700 hover:bg-orange-200' : ''
          ]"
          @click="() => returnMode = !returnMode"
          :aria-label="returnMode ? 'Mode retour activé' : 'Mode retour désactivé'"
        >
          <RefreshCcw class="w-4 h-4" />
        </Button>
      </div>
    </div>

  <!-- Liste des produits du panier -->
  <div class="flex-1 min-h-0">
  <ScrollArea class="h-full w-full rounded-md p-4">
    <div class="flex flex-col gap-2">
      <TransitionGroup tag="div" name="fade-slide" class="flex flex-col gap-2">
        <CaisseCartItem v-for="(product, index) in cart" :key="(product as any)._uniqueId || (product.id + '-' + product.variation + '-' + index)" :product="product"
          @remove="() => removeFromCartByIndex(index)" :is-locked="isCartLocked" />
      </TransitionGroup>
      <!-- 🔻 Élément invisible pour scroll auto -->
      <div ref="bottomRef" />
    </div>
  </ScrollArea>
  </div>

  <!-- Dialog unique de confirmation de retour : liste des articles + remise en stock par ligne -->
  <AlertDialog v-model:open="returnConfirmOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Confirmer le retour</AlertDialogTitle>
      </AlertDialogHeader>
      <div class="space-y-3">
        <p class="text-sm text-muted-foreground">
          Vérifiez les articles retournés et choisissez ceux à remettre en stock.
        </p>

        <!-- En-tête : tout remettre en stock -->
        <label class="flex items-center gap-2 border-b pb-2 text-sm font-medium">
          <Checkbox v-model="allRestock" aria-label="Tout remettre en stock" />
          Tout remettre en stock
        </label>

        <!-- Une ligne par article retourné -->
        <ul class="space-y-2 max-h-64 overflow-y-auto">
          <li
            v-for="item in returnedItems"
            :key="(item as any)._uniqueId || (item.id + '-' + item.variation)"
            class="flex items-center justify-between gap-3 text-sm"
          >
            <div class="min-w-0">
              <div class="truncate font-medium">{{ item.name }}</div>
              <div class="text-xs text-muted-foreground">
                <span v-if="item.variation">{{ item.variation }} · </span>Quantité : {{ Math.abs(item.quantity) }}
              </div>
            </div>
            <label class="flex shrink-0 items-center gap-2 text-xs">
              <Checkbox v-model="item.restockOnReturn" :aria-label="`Remettre en stock ${item.name}`" />
              Remettre en stock
            </label>
          </li>
        </ul>
      </div>
      <AlertDialogFooter class="mt-4">
        <AlertDialogCancel @click="cancelReturnConfirm">
          Annuler
        </AlertDialogCancel>
        <AlertDialogAction @click="confirmReturn">
          Confirmer le retour
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  </div>
</template>
