<script setup lang="ts">
import { ref, watch, computed, nextTick, type Ref } from 'vue'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import CartItem from './CartItem.vue'
import {
  Combobox, ComboboxAnchor, ComboboxInput, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxGroup
} from '@/components/ui/combobox'
import { Barcode } from 'lucide-vue-next'
import type { ProductBase, ProductInCart, VariationGroup } from '@/types/pos'

const props = defineProps(['cart', 'products'])

const Products = computed(() => props.products)
const barcodeInput = ref('')
const cart = toRef(props, 'cart') as Ref<ProductInCart[]>
const selectedProduct = ref<ProductBase | null>(null)
const bottomRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (bottomRef.value) {
      bottomRef.value.scrollIntoView({ behavior: 'smooth' })
    }
  })
}

function searchByBarcode() {
  const found = Products.value.find((p: ProductBase) => p.barcode === barcodeInput.value)
  if (found) addToCart(found)
  barcodeInput.value = ''
}

function removeFromCart(id: number) {
  const index = cart.value.findIndex(p => p.id === id)
  if (index !== -1) cart.value.splice(index, 1)
}

function addToCart(product: ProductBase) {
  if (!cart.value) {
    console.error('cart.value is undefined')
    return
  }

  const existing = cart.value.find(
    (p: ProductInCart) => p.id === product.id && p.variation === ''
  )

  if (existing) {
    existing.quantity += 1
  } else {
    cart.value.push({
      ...(product as ProductBase),
      quantity: 1,
      discount: 0,
      discountType: '%',
      variation: '',
      stock: product.stock,
      stockByVariation: product.stockByVariation ?? {}
    } as ProductInCart)
  }

  console.log('Produit ajouté :', product)
  scrollToBottom()
}

watch(selectedProduct, (product) => {
  if (product) {
    addToCart(product)
    selectedProduct.value = null
  }
})

// Exemple statique de groupes de variations, peut être déplacé dans un fichier global
const variationGroups: VariationGroup[] = [
  {
    id: 'color',
    name: 'Couleur',
    options: [
      { label: 'Noir', value: 'noir' },
      { label: 'Bleu', value: 'bleu' },
      { label: 'Vert', value: 'vert' }
    ]
  },
  {
    id: 'nicotine',
    name: 'Taux de nicotine',
    options: [
      { label: '0mg', value: '0mg' },
      { label: '3mg', value: '3mg' },
      { label: '6mg', value: '6mg' }
    ]
  },
  {
    id: 'resistance',
    name: 'Résistance',
    options: [
      { label: '0.15Ω', value: '0.15' },
      { label: '0.2Ω', value: '0.2' }
    ]
  }
]
</script>

<template>
  <div class="w-full flex justify-center gap-4">
    <!-- 📷 Scan -->
    <div class="relative">
      <Barcode class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <Input v-model="barcodeInput" placeholder="Scanner un code-barres" class="w-full px-3 text-sm pl-10"
        @keyup.enter="searchByBarcode" />
    </div>

    <!-- 🔍 Recherche -->
    <Combobox v-model="selectedProduct" :options="Products" :option-value="(p: ProductBase) => p.id"
      :option-label="(p: ProductBase) => p.name" :get-option-value="(p: ProductBase) => p.id"
      :get-option-label="(p: ProductBase) => p.name">
      <ComboboxAnchor>
        <div class="relative w-full items-center rounded-md border">
          <ComboboxInput placeholder="Rechercher un produit" class="w-full h-full text-sm" />
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

  <!-- Liste des produits -->
  <ScrollArea class="h-[calc(100vh-180px)] w-full rounded-md p-4">
    <div class="flex flex-col gap-2">
      <TransitionGroup tag="div" name="fade-slide" class="flex flex-col gap-2">
        <CartItem v-for="product in cart" :key="product.id" :product="product"
          :variation-groups="variationGroups" @remove="removeFromCart" />
      </TransitionGroup>
      <!-- 🔻 Élément de référence invisible pour scroll auto -->
      <div ref="bottomRef" />
    </div>
  </ScrollArea>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
