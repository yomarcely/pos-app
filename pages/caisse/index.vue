<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useCustomerStore } from '@/stores/customer'
import { useSellersStore } from '@/stores/sellers'
import { useVariationGroupsStore } from '@/stores/variationGroups'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

const sellersStore = useSellersStore()
const productsStore = useProductsStore()
const customerStore = useCustomerStore()
const variationStore = useVariationGroupsStore()
const { selectedEstablishmentId } = useEstablishmentRegister()

// Charger les vendeurs en fonction de l'établissement sélectionné
async function loadSellersForEstablishment() {
  if (selectedEstablishmentId.value) {
    await sellersStore.loadSellers(selectedEstablishmentId.value)
  } else {
    await sellersStore.loadSellers()
  }
}

onMounted(() => {
  productsStore.loadProducts()
  customerStore.loadCustomers()
  loadSellersForEstablishment()
  variationStore.loadGroups()
})

// Recharger les vendeurs quand l'établissement change
watch(selectedEstablishmentId, () => {
  loadSellersForEstablishment()
})
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <!-- 🟦 Header -->
    <CaisseHeader />

    <!-- 🧩 Grille principale -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4 p-4 overflow-hidden">
      <aside class="h-full rounded-lg shadow bg-muted/50 p-4 overflow-hidden">
        <CaisseColLeft />
      </aside>

      <main class="h-full rounded-lg shadow bg-muted/50 p-4 overflow-hidden">
        <CaisseColMiddle />
      </main>

      <aside class="h-full rounded-lg shadow bg-muted/50 p-4 overflow-hidden">
        <CaisseColRight />
      </aside>
    </div>
  </div>
</template>