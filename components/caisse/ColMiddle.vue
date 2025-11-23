<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Combobox, ComboboxAnchor, ComboboxInput, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxGroup
} from '@/components/ui/combobox'
import { Barcode } from 'lucide-vue-next'
import type { Product } from '@/types'

import { storeToRefs } from 'pinia'
import { useProductsStore } from '@/stores/products'
import { useCartStore } from '@/stores/cart'
import { useVariationGroupsStore } from '@/stores/variationGroups'

const productsStore = useProductsStore()
const cartStore = useCartStore()
const variationStore = useVariationGroupsStore()

const { products: Products } = storeToRefs(productsStore)
const { items: cart, selectedProduct } = storeToRefs(cartStore)
const { groups: variationGroups } = storeToRefs(variationStore)

const barcodeInput = ref('')
const bottomRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

// Fonction pour obtenir le nom d'une variation par son ID
function getVariationNameById(variationId: number): string {
  for (const group of variationGroups.value) {
    const variation = group.variations.find(v => v.id === variationId)
    if (variation) {
      return variation.name
    }
  }
  return `Variation ${variationId}`
}

function searchByBarcode() {
  const scannedBarcode = barcodeInput.value.trim()
  if (!scannedBarcode) return

  // 1. Chercher d'abord dans les codes-barres principaux des produits
  let found = Products.value.find(p => p.barcode === scannedBarcode)
  if (found) {
    handleProductAdd(found)
    barcodeInput.value = ''
    return
  }

  // 2. Chercher dans les codes-barres par variation
  for (const product of Products.value) {
    if (product.barcodeByVariation) {
      // barcodeByVariation est un objet { "variationId": "barcode" }
      for (const [variationId, barcode] of Object.entries(product.barcodeByVariation)) {
        if (barcode === scannedBarcode) {
          // Trouvé ! Ajouter le produit avec cette variation spécifique
          const variationName = getVariationNameById(parseInt(variationId))
          cartStore.addToCart(product, variationName)
          scrollToBottom()
          barcodeInput.value = ''
          return
        }
      }
    }
  }

  // 3. Aucun produit trouvé
  barcodeInput.value = ''
}

function isProduct(v: unknown): v is Product {
  return typeof v === 'object' && v !== null && 'id' in v && 'name' in v
}

function onProductSelected(p: Product | null) {
  if (!p) return
  handleProductAdd(p)
  selectedProduct.value = null as any
}

function handleProductAdd(product: Product) {
  // Si le produit a des variations, choisir automatiquement la première
  if (product.variationGroupIds && product.variationGroupIds.length > 0) {
    // Prendre le premier ID de variation et le convertir en nom
    const firstVariationId = product.variationGroupIds[0]
    if (firstVariationId !== undefined) {
      const firstVariationName = getVariationNameById(firstVariationId)
      cartStore.addToCart(product, firstVariationName)
    } else {
      cartStore.addToCart(product, '')
    }
  } else {
    // Sinon, ajouter directement
    cartStore.addToCart(product, '')
  }
  scrollToBottom()
}

// ✅ wrapper qui matche la signature attendue par la Combobox
function onComboboxUpdate(value: unknown) {
  onProductSelected(isProduct(value) ? value : null)
}

function removeFromCart(id: number, variation: string) {
  cartStore.removeFromCart(id, variation)
}
</script>

<template>
  <div class="w-full flex justify-center gap-4">
    <!-- 📷 Scan code-barres -->
    <div class="relative">
      <Barcode class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <Input v-model="barcodeInput" placeholder="Scanner code-barres" class="w-full px-3 text-sm pl-10"
        @keydown.enter="searchByBarcode" />
    </div>

    <!-- 🔍 Recherche produit -->
    <!-- ✅ On enlève :option-value pour travailler avec l'objet complet -->
    <Combobox v-model="selectedProduct"
  :options="Products"
  :option-label="(p: Product) => p.name"
  @update:modelValue="onComboboxUpdate">
      <ComboboxAnchor>
        <div class="relative w-full items-center rounded-md border">
          <ComboboxInput placeholder="Recherche produit" class="w-full h-full text-sm px-3" />
        </div>
      </ComboboxAnchor>
      <ComboboxList>
        <ComboboxEmpty>Aucun résultat</ComboboxEmpty>
        <ComboboxGroup>
          <ComboboxItem v-for="item in Products" :key="item.id" :value="item">
            <div class="flex items-center gap-2">
              <img :src="item.image" class="w-6 h-6 rounded" />
              <span class="flex-1">{{ item.name }}</span>
              <span class="text-sm text-gray-500">{{ item.price.toFixed(2) }} €</span>
            </div>
          </ComboboxItem>
        </ComboboxGroup>
      </ComboboxList>
    </Combobox>
  </div>

  <!-- Liste des produits du panier -->
  <ScrollArea class="h-[calc(100vh-180px)] w-full rounded-md p-4">
    <div class="flex flex-col gap-2">
      <TransitionGroup tag="div" name="fade-slide" class="flex flex-col gap-2">
        <CaisseCartItem v-for="product in cart" :key="product.id + '-' + product.variation" :product="product"
          @remove="removeFromCart" />
      </TransitionGroup>
      <!-- 🔻 Élément invisible pour scroll auto -->
      <div ref="bottomRef" />
    </div>
  </ScrollArea>
</template>
