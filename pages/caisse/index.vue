
<script setup lang="ts">
import ColLeft from '@/components/caisse/ColLeft.vue'
import ColMiddle from '@/components/caisse/ColMiddle.vue'
import ColRight from '@/components/caisse/ColRight.vue'
import Header from '~/components/caisse/Header.vue'

import { ref } from 'vue'
import type { ProductBase, ProductInCart, ClientBase } from '@/types/pos'

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
const cart = ref<ProductInCart[]>([])
const products = ref<ProductBase[]>([
  {
    id: 1,
    name: 'Freeze Fruit du Dragon 50ml',
    price: 14.90,
    image: '/assets/img/freeze-dragon.png',
    barcode: '1234567890123',
    stock: 10,
    purchasePrice: 8.9,
    tva: 20
  },
  {
    id: 2,
    name: 'Booster 50/50',
    price: 1,
    image: '/assets/img/booster.png',
    stock: 400,
    purchasePrice: 0.2,
    tva: 20
  },
  {
    id: 3,
    name: '-20 GeekVape Serie Z',
    price: 3.5,
    variationGroupIds: ['resistance'],
    image: '/assets/img/series-z.png',
    stockByVariation: {
      '0.15': 10,
      '0.2': 18,
    },
    purchasePrice: 1,
    tva: 20
  },
  {
    id: 4,
    name: '-20 GeekVape Serie B',
    price: 3.5,
    variationGroupIds: ['resistance'],
    image: '/assets/img/series-z.png',
    stockByVariation: {
      '0.15': 8,
      '0.2': 3,
    },
    purchasePrice: 1,
    tva: 20
  },
  {
    id: 5,
    name: 'GeekVape Z nano 2',
    price: 24.90,
    variationGroupIds: ['color'],
    image: '/assets/img/z-nano.png',
    stockByVariation: {
      noir: 4,
      bleu: 2,
      vert: 7,
    },
    purchasePrice: 12,
    tva: 20
  },
  {
    id: 6,
    name: 'Pulp Cerise Glacée 10ml',
    price: 5.90,
    variationGroupIds: ['nicotine'],
    image: '/assets/img/pulp-cerise.png',
    stockByVariation: {
      '0mg': 10,
      '3mg': 0,
      '6mg': 6,
    },
    purchasePrice: 2.5,
    tva: 20
  },
])
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">

    <!-- 🟦 Header -->
     <Header />

    <!-- 🧩 Grille principale -->
    <div class="h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4 p-4 overflow-hidden">
      <aside class="p-4 h-full rounded-lg shadow bg-muted/50">
        <ColLeft :clients="clients"/>
      </aside>

      <main class="p-4 rounded-lg shadow space-y-4 overflow-hidden bg-muted/50 h-full">
        <ColMiddle :cart="cart" :products="products" />
      </main>

      <aside class="flex flex-col justify-between h-full rounded-lg shadow bg-muted/50 p-4">
        <ColRight :cart="cart" />
      </aside>
    </div>
  </div>
</template>
