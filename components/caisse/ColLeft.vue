<script setup lang="ts">
import { computed, ref } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Combobox, ComboboxAnchor, ComboboxInput, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxGroup
} from '@/components/ui/combobox'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserRoundPlus, X, User, List } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { useSellersStore } from '@/stores/sellers'
const isPendingDialogOpen = ref(false)

const cartStore = useCartStore()
const customerStore = useCustomerStore()
const sellersStore = useSellersStore()
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
  console.log('Fiche client')
}
function openClientHistory() {
  console.log('Historique client')
}
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-auto">
    <!-- Sélecteur vendeur -->
    <div class="flex-shrink-0">
      <label class="text-sm font-semibold">Vendeur</label>
      <Select v-model="sellersStore.selectedSeller">
        <SelectTrigger>
          <SelectValue placeholder="Sélectionner un vendeur" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="seller in sellersStore.sellers" :key="seller.id" :value="String(seller.id)">
            {{ seller.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Client -->
    <div class="flex-shrink-0">
      <label class="text-sm font-semibold">Client</label>
      <div class="flex items-center gap-2 mt-2">
        <!-- 🔍 Recherche -->
        <client-only>
          <Combobox v-model="selectedClient" :options="Clients" option-value="id" option-label="name"
            get-option-value="id" get-option-label="name">
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
                    <div class="font-semibold text-sm">{{ item.name }} {{ item.lastname }}</div>
                    <div class="text-xs text-gray-500">{{ item.city }}</div>
                  </div>
                </ComboboxItem>
              </ComboboxGroup>
            </ComboboxList>
          </Combobox>
        </client-only>

        <client-only>
          <!-- ➕ Bouton ajout client -->
          <Dialog>
            <DialogTrigger class="flex items-center">
              <Button variant="outline">
                <UserRoundPlus class="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <CaisseAddClientForm />
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
                {{ selectedClient.name }} {{ selectedClient.lastname }}
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

    <!-- Remise globale -->
    <div class="flex-shrink-0">
      <label class="text-sm font-semibold">Remise globale</label>
      <div class="flex gap-2 mt-2">
        <Input type="number" min="0" placeholder="0" class="w-full" v-model.number="cartStore.globalDiscount" />
        <Select v-model="cartStore.globalDiscountType">
          <SelectTrigger class="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="%">%</SelectItem>
            <SelectItem value="€">€</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="secondary"
        class="w-full mt-2"
        @click="cartStore.applyGlobalDiscountToItems()"
        :disabled="cartStore.items.length === 0 || cartStore.globalDiscount === 0"
      >
        Appliquer la remise
      </Button>
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
  </div>
</template>
