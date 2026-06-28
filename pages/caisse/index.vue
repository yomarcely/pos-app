<script setup lang="ts">
import { onMounted, watch, ref, provide } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { useSellersStore } from '@/stores/sellers'
import { useVariationGroupsStore } from '@/stores/variationGroups'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useCaisseShortcuts } from '@/composables/useCaisseShortcuts'

const sellersStore = useSellersStore()
const productsStore = useProductsStore()
const customerStore = useCustomerStore()
const variationStore = useVariationGroupsStore()
const { selectedEstablishmentId, selectedRegisterId } = useEstablishmentRegister()
const cartStore = useCartStore()

// Restauration du panier persisté (anti-perte F5). Une seule tentative effective :
// au montage si la caisse est déjà connue, sinon dès que selectedRegisterId est résolu.
let cartRestoreAttempted = false
function tryRestoreCart() {
  if (cartRestoreAttempted || !selectedRegisterId.value) return
  cartRestoreAttempted = true
  cartStore.restorePersistedCart()
}

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
  tryRestoreCart()
})

watch(selectedRegisterId, () => { tryRestoreCart() })

// ===========================================
// Raccourcis clavier — montés UNIQUEMENT ici (page caisse).
// L'état (solde, soumission, clôture) et les actions vivent dans les colonnes :
// la page tient un ref sur chacune et y délègue via leurs méthodes exposées.
// ===========================================
const colLeftRef = ref<{ putOnHold: () => void; closeOverlay: () => boolean } | null>(null)
const colMiddleRef = ref<{ focusSearch: () => void; removeLastItem: () => void } | null>(null)
const colRightRef = ref<{
  isSubmitting: boolean
  isDayClosed: boolean
  balance: number
  addPayment: (mode: string) => void
  validerVente: () => void
} | null>(null)

// Détecte un overlay Reka ouvert (Dialog/AlertDialog de ColRight & ColMiddle, fermés
// nativement par Reka sur Échap). On se contente de signaler sa présence pour ne pas
// enchaîner sur le focus recherche. Les overlays de ColLeft sont fermés explicitement.
function hasOpenRekaOverlay(): boolean {
  if (typeof document === 'undefined') return false
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
}

useCaisseShortcuts({
  isSubmitting: () => colRightRef.value?.isSubmitting ?? false,
  isDayClosed: () => colRightRef.value?.isDayClosed ?? false,
  getBalance: () => colRightRef.value?.balance ?? 0,
  payCash: () => colRightRef.value?.addPayment('Espèces'),
  payCard: () => colRightRef.value?.addPayment('Carte'),
  validateSale: () => colRightRef.value?.validerVente(),
  removeLastItem: () => colMiddleRef.value?.removeLastItem(),
  putOnHold: () => colLeftRef.value?.putOnHold(),
  closeTopOverlay: () => (colLeftRef.value?.closeOverlay() ?? false) || hasOpenRekaOverlay(),
  focusProductSearch: () => colMiddleRef.value?.focusSearch(),
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
      <aside class="h-full rounded-lg shadow-sm border border-border bg-card p-4 overflow-hidden">
        <CaisseColLeft ref="colLeftRef" />
      </aside>

      <main class="h-full rounded-lg shadow-sm border border-border bg-card p-4 overflow-hidden">
        <CaisseColMiddle ref="colMiddleRef" />
      </main>

      <aside class="h-full rounded-lg shadow-sm border border-border bg-card p-4 overflow-hidden">
        <CaisseColRight ref="colRightRef" @payments-changed="hasPayments = $event" />
      </aside>
    </div>
  </div>
</template>
