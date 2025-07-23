
<script setup lang="ts">

import { ref } from 'vue'
import type { ProductBase, ProductInCart, ClientBase } from '@/types'
import { storeToRefs } from 'pinia'
import { useProductsStore } from '@/stores/products'
import { useCartStore } from '@/stores/cart'


const productsStore = useProductsStore()
const cartStore = useCartStore()

const { products } = storeToRefs(productsStore)
const { items: cart } = storeToRefs(cartStore)

// Données partagées
const clients = ref<ClientBase[]>([
  {
    id: 1,
    name: 'Yohan',
    lastname: 'Marcel',
    postalcode: 84300,
    city: 'Cavaillon'
  },
  {
    id: 2,
    name: 'Jade',
    lastname: 'Fachinetti',
    postalcode: 84000,
    city: 'Avigon'
  },
  {
    id: 3,
    name: 'Diego',
    lastname: 'Lupu',
    postalcode: 84300,
    city: 'Cavaillon'
  },
])
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">

    <!-- 🟦 Header -->
     <CaisseHeader />

    <!-- 🧩 Grille principale -->
    <div class="h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4 p-4 overflow-hidden">
      <aside class="p-4 h-full rounded-lg shadow bg-muted/50">
        <CaisseColLeft :clients="clients"/>
      </aside>

      <main class="p-4 rounded-lg shadow space-y-4 overflow-hidden bg-muted/50 h-full">
        <CaisseColMiddle :cart="cart" :products="products" />
      </main>

      <aside class="flex flex-col justify-between h-full rounded-lg shadow bg-muted/50 p-4">
        <CaisseColRight :cart="cart" />
      </aside>
    </div>
  </div>
</template>
