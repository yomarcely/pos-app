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

const productsStore = useProductsStore()
const cartStore = useCartStore()

const { products: Products } = storeToRefs(productsStore)
const { items: cart, selectedProduct } = storeToRefs(cartStore)

const barcodeInput = ref('')
const bottomRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (bottomRef.value) {
      bottomRef.value.scrollIntoView({ behavior: 'smooth' })
    }
  })
}

function searchByBarcode() {
  const found = Products.value.find(p => p.barcode === barcodeInput.value)
  if (found) {
    cartStore.addToCart(found)
    scrollToBottom()
  }
  barcodeInput.value = ''
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
        @keyup.enter="searchByBarcode" />
    </div>

    <!-- 🔍 Recherche produit -->
    <Combobox v-model="selectedProduct" :options="Products" :option-label="(p: Product) => p.name"
      :option-value="(p: Product) => p.id">
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
