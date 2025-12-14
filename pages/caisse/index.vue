<script setup lang="ts">
import { onMounted, watch, ref, provide } from 'vue'
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

// État pour savoir si des paiements sont en cours
const hasPayments = ref(false)
provide('hasPayments', hasPayments)

const sellerInitialized = ref(false)

onMounted(() => {
  productsStore.loadProducts()
  customerStore.loadCustomers()
  variationStore.loadGroups()
  sellersStore.initialize(selectedEstablishmentId.value ?? undefined).then(() => {
    sellerInitialized.value = true
  })
})

// Recharger/réinitialiser les vendeurs quand l'établissement change
watch(selectedEstablishmentId, async (newId, oldId) => {
  if (!sellerInitialized.value) return

  await sellersStore.loadSellers(newId ?? undefined)

  // Si l'établissement change réellement, on remet à zéro
  if (oldId && newId !== oldId) {
    sellersStore.selectSellerById(null)
    return
  }

  // Si l'établissement reste le même (ex: restauration au reload), ne pas reset,
  // mais on vérifie que le vendeur existe toujours
  const hasCurrentSeller = sellersStore.selectedSeller
    ? sellersStore.sellers.some(s => s.id === Number(sellersStore.selectedSeller))
    : false

  if (!hasCurrentSeller) {
    sellersStore.selectSellerById(null)
  }
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
        <CaisseColRight @payments-changed="hasPayments = $event" />
      </aside>
    </div>
  </div>
</template>
