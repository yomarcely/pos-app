<script setup lang="ts">
import { onMounted } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useCustomerStore } from '@/stores/customer'
import { useSellersStore } from '@/stores/sellers'
import { useVariationGroupsStore } from '@/stores/variationGroups'

const sellersStore = useSellersStore()
const productsStore = useProductsStore()
const customerStore = useCustomerStore()
const variationStore = useVariationGroupsStore()

onMounted(() => {
  productsStore.loadProducts()
  customerStore.loadCustomers()
  sellersStore.loadSellers()
  variationStore.loadGroups()
})
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <!-- 🟦 Header -->
    <CaisseHeader />

    <!-- 🧩 Grille principale -->
    <div class="h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4 p-4 overflow-hidden">
      <aside class="p-4 h-full rounded-lg shadow bg-muted/50">
        <CaisseColLeft />
      </aside>

      <main class="p-4 rounded-lg shadow space-y-4 overflow-hidden bg-muted/50 h-full">
        <CaisseColMiddle />
      </main>

      <aside class="flex flex-col justify-between h-full rounded-lg shadow bg-muted/50 p-4">
        <CaisseColRight />
      </aside>
    </div>
  </div>
</template>