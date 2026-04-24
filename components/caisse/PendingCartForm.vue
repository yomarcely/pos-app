<script setup lang="ts">
import { ref, computed } from 'vue'
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useToast } from '@/composables/useToast'
import { extractFetchError } from '@/composables/useFetchError'
import {
  Table, TableHead, TableHeader, TableRow, TableCell, TableBody
} from '@/components/ui/table'
import { Trash2 } from 'lucide-vue-next'

const cartStore = useCartStore()
const customerStore = useCustomerStore()
const { selectedEstablishmentId, selectedRegisterId, allRegisters } = useEstablishmentRegister()
const toast = useToast()

const selectedCartId = ref<number | null>(null)
const busy = ref(false)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const selectedCart = computed(() =>
  cartStore.pendingCart.find(c => c.id === selectedCartId.value)
)

function registerName(registerId: number): string {
  return allRegisters.value.find(r => r.id === registerId)?.name ?? `Caisse #${registerId}`
}

async function handleRecover() {
  if (selectedCartId.value === null) return
  if (!selectedEstablishmentId.value || !selectedRegisterId.value) return

  busy.value = true
  try {
    await cartStore.recoverPendingCart(
      selectedCartId.value,
      selectedEstablishmentId.value,
      selectedRegisterId.value,
    )
    selectedCartId.value = null
    emit('close')
  } catch (error: unknown) {
    console.error('Erreur lors de la reprise:', error)
    toast.error(extractFetchError(error, 'Impossible de reprendre le ticket'))
  } finally {
    busy.value = false
  }
}

async function handleDelete() {
  if (selectedCartId.value === null) return
  if (!selectedEstablishmentId.value || !selectedRegisterId.value) return
  if (!confirm('Supprimer définitivement ce ticket en attente ?')) return

  busy.value = true
  try {
    await cartStore.deletePendingCart(
      selectedCartId.value,
      selectedEstablishmentId.value,
      selectedRegisterId.value,
    )
    selectedCartId.value = null
    toast.success('Ticket supprimé')
  } catch (error: unknown) {
    console.error('Erreur lors de la suppression:', error)
    toast.error(extractFetchError(error, 'Impossible de supprimer le ticket'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DialogContent class="!max-w-[100vh] h-[60vh] max-h-[60vh] flex flex-col">
    <DialogHeader class="flex-shrink-0">
      <DialogTitle>Tickets en attente</DialogTitle>
      <DialogDescription v-if="cartStore.pendingSharedAcrossRegisters">
        Partage activé : tickets de toutes les caisses de l'établissement.
      </DialogDescription>
    </DialogHeader>

    <div class="grid grid-cols-2 gap-6 flex-1 min-h-0">
      <!-- 🧾 Liste des paniers -->
      <div class="border rounded-md overflow-y-auto bg-muted/5 h-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="text-left">Panier</TableHead>
              <TableHead class="text-left">Caisse</TableHead>
              <TableHead class="text-left">Client</TableHead>
              <TableHead class="text-center">Articles</TableHead>
              <TableHead class="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="cart in cartStore.pendingCart" :key="cart.id"
              :class="selectedCartId === cart.id ? 'bg-primary/10' : 'hover:bg-muted/50 cursor-pointer'"
              @click="selectedCartId = cart.id">
              <TableCell>#{{ cart.id }}</TableCell>
              <TableCell class="text-xs">
                {{ registerName(cart.registerId) }}
              </TableCell>
              <TableCell>
                {{
                  cart.customerId
                    ? customerStore.clients.find(c => c.id === cart.customerId)?.firstName ?? 'Client inconnu'
                    : 'Aucun'
                }}
              </TableCell>
              <TableCell class="text-center">{{ cart.items.length }}</TableCell>
              <TableCell class="text-right">
                {{
                  cart.items.reduce((sum, item) => {
                    const unit = item.discountType === '%'
                      ? item.price * (1 - item.discount / 100)
                      : item.price - item.discount
                    return sum + unit * item.quantity
                  }, 0).toFixed(2)
                }} €
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div v-if="cartStore.pendingCart.length === 0" class="p-6 text-center text-sm text-muted-foreground">
          Aucun ticket en attente
        </div>
      </div>

      <!-- 🛒 Aperçu du panier -->
      <div class="flex flex-col justify-between border rounded-md p-4 h-full bg-muted/5 w-full">
        <div class="space-y-3 overflow-y-auto max-h-[400px]">
          <template v-if="selectedCart">
            <div
              v-for="item in selectedCart.items"
              :key="item.id + '-' + item.variation"
              class="flex items-center justify-between gap-2 border-b pb-2"
            >
              <img v-if="item.image" :src="item.image" alt="Produit" class="w-12 h-12 rounded object-cover" />
              <div class="flex-1">
                <div class="font-medium text-sm">{{ item.name }}</div>
                <div class="text-xs text-muted-foreground">x{{ item.quantity }}</div>
              </div>
              <div class="text-sm">{{ (item.price * item.quantity).toFixed(2) }} €</div>
            </div>
          </template>
          <template v-else>
            <p class="text-muted-foreground text-sm">Sélectionnez un panier à gauche</p>
          </template>
        </div>

        <!-- Boutons -->
        <div class="mt-4 flex gap-2">
          <Button
            variant="outline"
            :disabled="!selectedCart || busy"
            @click="handleDelete"
            class="shrink-0"
          >
            <Trash2 class="w-4 h-4" />
          </Button>
          <Button class="flex-1" :disabled="!selectedCart || busy" @click="handleRecover">
            Récupérer
          </Button>
        </div>
      </div>
    </div>
  </DialogContent>
</template>

<style scoped>
.large-dialog {
  width: 100% !important;
  max-width: 80rem !important;
}
</style>
