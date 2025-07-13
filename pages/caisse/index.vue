
<script setup lang="ts">
import ColLeft from '@/components/caisse/ColLeft.vue'
import ColMiddle from '@/components/caisse/ColMiddle.vue'
import ColRight from '@/components/caisse/ColRight.vue'
import Header from '~/components/caisse/Header.vue'

import { ref } from 'vue'
import type { ProductBase, ProductInCart } from '@/types/pos'

// Données partagées
const selectedClient = ref<null | { name: string; city: string }>({ name: 'Jean Dupont', city: 'Cavaillon' })
const cart = ref<ProductInCart[]>([])
const products = ref<ProductBase[]>([
  {
    id: 1,
    name: 'Freeze Fruit du Dragon 50ml',
    price: 14.90,
    variationGroupId: '',
    image: '/assets/img/freeze-dragon.png',
    barcode: '1234567890123',
  },
  {
    id: 2,
    name: 'Booster 50/50',
    price: 1,
    variationGroupId: '',
    image: '/assets/img/booster.png',
  },
  {
    id: 3,
    name: '-20 GeekVape Serie Z',
    price: 3.5,
    variationGroupId: 'resistance',
    image: '/assets/img/series-z.png',
  },
  {
    id: 4,
    name: '-20 GeekVape Serie Z',
    price: 3.5,
    variationGroupId: 'resistance',
    image: '/assets/img/series-z.png',
  },
  {
    id: 5,
    name: 'GeekVape Z nano 2',
    price: 24.90,
    variationGroupId: 'color',
    image: '/assets/img/z-nano.png',
  },
  {
    id: 6,
    name: 'Pulp Cerise Glacée 10ml',
    price: 5.90,
    variationGroupId: 'nicotine',
    image: '/assets/img/pulp-cerise.png',
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
        <ColLeft />
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
