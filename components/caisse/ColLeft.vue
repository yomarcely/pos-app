<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import {
  Combobox, ComboboxAnchor, ComboboxInput, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxGroup
} from '@/components/ui/combobox'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserRoundPlus, X, User, List, ShoppingBag, Star, Sparkles, Ticket } from 'lucide-vue-next'
import LoyaltyVouchersDialog from '@/components/caisse/LoyaltyVouchersDialog.vue'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useLoyaltyForCustomer } from '@/composables/useLoyaltyForCustomer'
import { useToast } from '@/composables/useToast'
import { extractFetchError } from '@/composables/useFetchError'
import type { PurchaseHistoryEntry } from '@/composables/useClientPurchaseHistory'
import type { Customer } from '@/types'

const isPendingDialogOpen = ref(false)
const isAddClientDialogOpen = ref(false)
const isHistoryDrawerOpen = ref(false)
const loadingPurchases = ref(false)
const purchases = ref<PurchaseHistoryEntry[]>([])

const cartStore = useCartStore()
const customerStore = useCustomerStore()
const { selectedEstablishmentId, selectedRegisterId } = useEstablishmentRegister()
const { status: loyaltyStatus, isEligibleForReward, toggleReward } = useLoyaltyForCustomer()

// Modale vouchers actifs du client (utilisation comme moyen de paiement)
const vouchersDialogOpen = ref(false)
const activeVouchers = computed(() => loyaltyStatus.value?.vouchers ?? [])
const appliedVoucherIds = computed(() => cartStore.appliedVouchers.map(v => v.id))

function toggleVoucher(voucherId: number) {
  const voucher = activeVouchers.value.find(v => v.id === voucherId)
  if (!voucher) return
  if (appliedVoucherIds.value.includes(voucherId)) {
    cartStore.removeAppliedVoucher(voucherId)
    toast.info(`Bon ${voucher.code} retiré`)
  }
  else {
    cartStore.addAppliedVoucher({
      id: voucher.id,
      code: voucher.code,
      amount: voucher.amount,
    })
    toast.success(`Bon ${voucher.code} appliqué (${voucher.amount.toFixed(2)} €)`)
  }
}

// Désélection client → reset des vouchers appliqués
watch(() => customerStore.client, (client) => {
  if (!client) {
    cartStore.clearAppliedVouchers()
  }
})
const toast = useToast()

// Tooltip contextuel selon que l'avantage est appliqué ou pas
const loyaltyTooltip = computed(() => {
  const s = loyaltyStatus.value
  if (!s || !s.rewardType || typeof s.rewardValue !== 'number') return ''
  const label = s.rewardType === 'percent_discount'
    ? `${s.rewardValue}% de remise`
    : s.rewardType === 'euro_discount'
      ? `${s.rewardValue.toFixed(2)} € de rabais`
      : `Bon d'achat de ${s.rewardValue.toFixed(2)} €`
  return cartStore.loyaltyReward
    ? `Avantage appliqué : ${label} — cliquer pour retirer`
    : `Avantage disponible : ${label} — cliquer pour appliquer`
})

async function handleAddPending() {
  if (!selectedEstablishmentId.value || !selectedRegisterId.value) {
    toast.error('Veuillez sélectionner un établissement et une caisse')
    return
  }
  try {
    const clientId = customerStore.client ? customerStore.client.id : null
    await cartStore.addPendingCart(selectedEstablishmentId.value, selectedRegisterId.value, clientId)
    customerStore.clearClient()
  } catch (error: unknown) {
    console.error('Erreur lors de la mise en attente:', error)
    toast.error(extractFetchError(error, 'Impossible de mettre le ticket en attente'))
  }
}

async function refreshPending() {
  if (!selectedEstablishmentId.value || !selectedRegisterId.value) return
  try {
    await cartStore.loadPendingCarts(selectedEstablishmentId.value, selectedRegisterId.value)
  } catch (error) {
    console.error('Erreur lors du chargement des tickets en attente:', error)
  }
}

onMounted(refreshPending)
watch([selectedEstablishmentId, selectedRegisterId], refreshPending)

const Clients = computed(() => customerStore.clients)
const selectedClient = computed({
  get: () => customerStore.client,
  set: (val) => {
    if (val) customerStore.selectClient(val)
    else customerStore.clearClient()
  }
})

function deselectClient() {
  customerStore.clearClient()
}

function openClientCard() {
  if (selectedClient.value?.id) {
    navigateTo(`/clients/${selectedClient.value.id}/edit`)
  }
}

function openClientHistory() {
  isHistoryDrawerOpen.value = true
  if (purchases.value.length === 0 && selectedClient.value?.id) {
    loadPurchaseHistory()
  }
}

async function loadPurchaseHistory() {
  if (!selectedClient.value?.id) return

  try {
    loadingPurchases.value = true
    const response = await $fetch<{ purchases: PurchaseHistoryEntry[] }>(`/api/clients/${selectedClient.value.id}/purchases`)
    purchases.value = response.purchases || []
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error)
  } finally {
    loadingPurchases.value = false
  }
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price)
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(date))
}

async function handleClientCreated(response: { client?: Customer }) {
  const client = (response.client || response) as Customer

  // Ajouter le client à la liste des clients dans le store
  customerStore.clients.push(client)

  // Sélectionner le client créé
  customerStore.selectClient(client)

  // Fermer le dialog
  isAddClientDialogOpen.value = false
}

// ===========================================
// Raccourcis clavier (useCaisseShortcuts, monté sur la page) :
// - Ctrl+S → mise en attente (putOnHold)
// - Échap  → ferme un overlay de cette colonne s'il est ouvert (closeOverlay)
// ===========================================
function putOnHold() {
  return handleAddPending()
}

/** Ferme le premier overlay ouvert de la colonne. Retourne true si quelque chose était ouvert. */
function closeOverlay(): boolean {
  if (isAddClientDialogOpen.value) { isAddClientDialogOpen.value = false; return true }
  if (vouchersDialogOpen.value) { vouchersDialogOpen.value = false; return true }
  if (isPendingDialogOpen.value) { isPendingDialogOpen.value = false; return true }
  if (isHistoryDrawerOpen.value) { isHistoryDrawerOpen.value = false; return true }
  return false
}

defineExpose({ putOnHold, closeOverlay })
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-auto">
    <!-- Client -->
    <div class="flex-shrink-0">
      <label class="text-sm font-semibold">Client</label>
      <div class="flex items-center gap-2 mt-2">
        <!-- 🔍 Recherche -->
        <client-only>
          <Combobox v-model="selectedClient" :options="Clients" option-value="id" option-label="firstName"
            get-option-value="id" get-option-label="firstName">
            <ComboboxAnchor>
              <div class="relative w-full flex items-center rounded-md border">
                <ComboboxInput placeholder="Recherche client" class="w-full h-full px-3 text-sm" />
              </div>
            </ComboboxAnchor>
            <ComboboxList>
              <ComboboxEmpty>Aucun résultat</ComboboxEmpty>
              <ComboboxGroup>
                <ComboboxItem v-for="item in Clients" :key="item.id" :value="item">
                  <div class="flex flex-col leading-tight">
                    <div class="font-semibold text-sm">{{ item.firstName }} {{ item.lastName }}</div>
                    <div class="text-xs text-gray-500">{{ item.city }}</div>
                  </div>
                </ComboboxItem>
              </ComboboxGroup>
            </ComboboxList>
          </Combobox>
          <template #fallback>
            <div class="relative w-full flex items-center rounded-md border px-3 py-2 text-sm text-muted-foreground bg-transparent">
              Recherche client
            </div>
          </template>
        </client-only>

        <client-only>
          <!-- ➕ Bouton ajout client -->
          <Dialog v-model:open="isAddClientDialogOpen">
            <DialogTrigger class="flex items-center">
              <Button variant="outline">
                <UserRoundPlus class="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <CaisseAddClientForm @success="handleClientCreated" />
          </Dialog>
        </client-only>
      </div>

      <!-- Card client sélectionné -->
      <div class="relative mt-2 px-4 py-3 rounded-md"
        :class="selectedClient ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border shadow-sm' : 'bg-transparent'"
        style="min-height: 72px;">
        <template v-if="selectedClient">
          <!-- ❌ Bouton de suppression client (top-right) -->
          <button
            @click="deselectClient"
            class="absolute top-2 right-2 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X class="w-4 h-4" />
          </button>

          <!-- Layout : ⭐ étoile loyalty | nom + sous-info | actions -->
          <div class="flex items-center gap-3 pr-7">
            <!-- ⭐ Toggle avantage fidélité (visible si éligible OU déjà appliqué) -->
            <button
              v-if="isEligibleForReward || cartStore.loyaltyReward"
              @click="toggleReward"
              :title="loyaltyTooltip"
              :class="[
                'flex flex-shrink-0 items-center justify-center h-7 w-7 rounded-full shadow-sm transition-colors',
                cartStore.loyaltyReward
                  ? 'bg-amber-400 hover:bg-amber-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-400',
              ]"
            >
              <Star class="w-4 h-4" :fill="cartStore.loyaltyReward ? 'currentColor' : 'none'" />
            </button>

            <!-- Nom + sous-ligne (ville + points) -->
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-base leading-tight truncate">
                {{ selectedClient.firstName }} {{ selectedClient.lastName }}
              </div>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-1">
                <span v-if="selectedClient.city">{{ selectedClient.city }}</span>
                <span v-if="selectedClient.city && loyaltyStatus?.optedIn" class="text-gray-300">•</span>
                <span
                  v-if="loyaltyStatus?.optedIn"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                  :title="`Points fidélité (seuil : ${loyaltyStatus.pointsRequired ?? '—'} pts)`"
                >
                  <Sparkles class="w-3 h-3" />
                  {{ loyaltyStatus.pointsCurrent ?? 0 }} pts
                </span>
                <span v-if="activeVouchers.length > 0" class="text-gray-300">•</span>
                <button
                  v-if="activeVouchers.length > 0"
                  @click="vouchersDialogOpen = true"
                  :title="`${activeVouchers.length} bon(s) d'achat actif(s) — cliquer pour gérer`"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                >
                  <Ticket class="w-3 h-3" />
                  {{ activeVouchers.length }} bon{{ activeVouchers.length > 1 ? 's' : '' }}
                  <span v-if="cartStore.appliedVouchers.length > 0" class="text-emerald-600 dark:text-emerald-400">
                    ({{ cartStore.appliedVouchers.length }} utilisé{{ cartStore.appliedVouchers.length > 1 ? 's' : '' }})
                  </span>
                </button>
              </div>
            </div>

            <!-- 🔘 Actions client (compact à droite) -->
            <div class="flex items-center gap-0.5 -mr-1">
              <button
                @click="openClientCard"
                title="Ouvrir la fiche client"
                class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <User class="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                @click="openClientHistory"
                title="Historique d'achats"
                class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <List class="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Mise en attente / Reprise -->
    <div class="flex gap-2 flex-shrink-0">
      <client-only>
        <!-- Bouton Mise en attente -->
        <Button variant="outline" class="flex-1" @click="handleAddPending">
          Mise en attente
          <kbd class="ml-1.5 text-[10px] font-normal text-muted-foreground">Ctrl+S</kbd>
        </Button>

        <!-- Dialog de reprise -->
        <Dialog class="flex-1" v-model:open="isPendingDialogOpen" @update:open="(v) => v && refreshPending()">
          <DialogTrigger>
            <Button variant="secondary">
              Reprise
              <Badge class="ml-2 bg-red-500" variant="default">
                {{ cartStore.pendingCart.length }}
              </Badge>
            </Button>
          </DialogTrigger>
          <CaissePendingCartForm @close="isPendingDialogOpen = false"/>
        </Dialog>
      </client-only>

    </div>

    <!-- Raccourcis -->
    <CaisseShortcutBoard class="mt-auto" />

    <!-- Drawer historique client -->
    <Drawer v-model:open="isHistoryDrawerOpen">
      <DrawerContent class="h-[50vh] flex flex-col">
        <DrawerHeader class="flex-shrink-0">
          <DrawerTitle>Historique d'achats</DrawerTitle>
          <DrawerDescription v-if="selectedClient">
            {{ selectedClient.firstName }} {{ selectedClient.lastName }}
          </DrawerDescription>
        </DrawerHeader>

        <div class="px-4 pb-4 overflow-y-auto" style="max-height: calc(50vh - 140px);">
          <!-- Loading -->
          <div v-if="loadingPurchases" class="flex items-center justify-center py-8">
            <div class="text-sm text-muted-foreground">Chargement de l'historique...</div>
          </div>

          <!-- Liste des achats -->
          <div v-else-if="purchases.length > 0" class="space-y-4">
            <div
              v-for="purchase in purchases"
              :key="purchase.id"
              class="border rounded-lg overflow-hidden"
            >
              <!-- En-tête du ticket -->
              <div class="bg-muted/50 p-4 border-b">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <ShoppingBag class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ purchase.ticketNumber }}</span>
                    <Badge :variant="purchase.status === 'completed' ? 'default' : 'secondary'">
                      {{ purchase.status === 'completed' ? 'Complété' : purchase.status }}
                    </Badge>
                  </div>
                  <span class="text-sm text-muted-foreground">
                    {{ formatDateTime(purchase.saleDate) }}
                  </span>
                </div>
              </div>

              <!-- Liste des produits -->
              <div class="p-4">
                <div v-if="purchase.items && purchase.items.length > 0" class="space-y-2">
                  <div
                    v-for="item in purchase.items"
                    :key="item.id"
                    class="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <div class="flex-1">
                      <div class="font-medium">{{ item.productName }}</div>
                      <div v-if="item.variation" class="text-xs text-muted-foreground">
                        {{ item.variation }}
                      </div>
                      <div class="text-sm text-muted-foreground flex items-center gap-2">
                        <span>Qté: {{ item.quantity }} × {{ formatPrice(parseFloat(item.unitPrice)) }}</span>
                        <Badge v-if="item.discount && parseFloat(item.discount) > 0" variant="outline" class="text-xs">
                          Remise {{ item.discountType === '%' ? `${item.discount}%` : `${formatPrice(parseFloat(item.discount))}` }}
                        </Badge>
                      </div>
                    </div>
                    <div class="text-right font-medium">
                      {{ formatPrice(parseFloat(item.totalTTC)) }}
                    </div>
                  </div>
                </div>
                <div v-else class="text-sm text-muted-foreground text-center py-2">
                  Chargement des produits...
                </div>

                <!-- Total -->
                <div class="flex items-center justify-between pt-3 mt-3 border-t font-bold">
                  <span>Total</span>
                  <span class="text-lg">{{ formatPrice(parseFloat(purchase.totalTTC)) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- État vide -->
          <div v-else class="flex flex-col items-center justify-center py-8 text-center">
            <ShoppingBag class="h-12 w-12 text-muted-foreground mb-4" />
            <h3 class="font-semibold text-lg mb-2">Aucun achat</h3>
            <p class="text-sm text-muted-foreground">Ce client n'a pas encore effectué d'achat</p>
          </div>
        </div>

        <DrawerFooter class="flex-shrink-0">
          <DrawerClose as-child>
            <Button variant="outline">Fermer</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>

    <!-- Modale de sélection des bons d'achat actifs -->
    <LoyaltyVouchersDialog
      :open="vouchersDialogOpen"
      :vouchers="activeVouchers"
      :applied-ids="appliedVoucherIds"
      @update:open="(v) => (vouchersDialogOpen = v)"
      @toggle="toggleVoucher"
      @close="vouchersDialogOpen = false"
    />
  </div>
</template>
