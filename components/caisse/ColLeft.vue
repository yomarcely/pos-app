<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Combobox, ComboboxAnchor, ComboboxInput, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxGroup
} from '@/components/ui/combobox'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserRoundPlus, X, User, List, ShoppingBag } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { useSellersStore } from '@/stores/sellers'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

const isPendingDialogOpen = ref(false)
const isAddClientDialogOpen = ref(false)
const isHistoryDrawerOpen = ref(false)
const loadingPurchases = ref(false)
const purchases = ref<any[]>([])

const cartStore = useCartStore()
const customerStore = useCustomerStore()
const sellersStore = useSellersStore()
const { selectedEstablishmentId } = useEstablishmentRegister()

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
    const response = await $fetch(`/api/clients/${selectedClient.value.id}/purchases`)
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

async function handleClientCreated(response: any) {
  const client = response.client || response

  // Ajouter le client à la liste des clients dans le store
  customerStore.clients.push(client)

  // Sélectionner le client créé
  customerStore.selectClient(client)

  // Fermer le dialog
  isAddClientDialogOpen.value = false
}
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
        style="min-height: 66px;">
        <template v-if="selectedClient">
          <!-- ❌ Bouton de suppression client -->
          <button @click="deselectClient" class="absolute top-2 right-2 text-gray-400 hover:text-red-500">
            <X class="w-4 h-4" />
          </button>

          <!-- 🧍 Infos client -->
          <div class="flex items-center justify-between">
            <div>
              <div class="font-semibold text-base">
                {{ selectedClient.firstName }} {{ selectedClient.lastName }}
              </div>
              <div class="text-xs text-gray-500">
                {{ selectedClient.city }}
              </div>
            </div>

            <!-- 🔘 Actions client -->
            <div class="flex items-center gap-2 pr-5">
              <button @click="openClientCard" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <User class="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <button @click="openClientHistory" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <List class="w-5 h-5 text-gray-600 dark:text-gray-300" />
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
        <Button variant="outline" class="flex-1" @click="cartStore.addPendingCart(customerStore.client ? customerStore.client.id : null);
        customerStore.clearClient()">
          Mise en attente
        </Button>

        <!-- Dialog de reprise -->
        <Dialog class="flex-1" v-model:open="isPendingDialogOpen">
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

    <!-- Grille de raccourcis -->
    <div class="flex-1 min-h-0 flex flex-col">
      <label class="text-sm font-semibold mb-2 block flex-shrink-0">Raccourcis</label>
      <div class="grid grid-cols-3 gap-2 overflow-auto flex-1 content-start">
        <ContextMenu v-for="n in 21" :key="n">
          <ContextMenuTrigger>
            <Button class="h-12 rounded text-sm w-full" variant="secondary">
              Vide
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Créer un raccourci produit</ContextMenuItem>
            <ContextMenuItem>Créer un raccourci client</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>Autre action</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>

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
  </div>
</template>
