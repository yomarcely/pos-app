<script setup lang="ts">
import { ref, computed } from 'vue'
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import {
  Table, TableHead, TableHeader, TableRow, TableCell, TableBody
} from '@/components/ui/table'

const cartStore = useCartStore()
const customerStore = useCustomerStore()

const selectedCartId = ref<number | null>(null)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const selectedCart = computed(() =>
  cartStore.pendingCart.find(c => c.id === selectedCartId.value)
)

function handleRecover() {
  if (selectedCartId.value !== null) {
    cartStore.recoverPendingCart(selectedCartId.value)
    selectedCartId.value = null
    emit('close')
  }
}
</script>

<template>
  <DialogContent class="!max-w-[100vh] h-[60vh] max-h-[60vh]">
    <!-- <DialogHeader>
      <DialogTitle>Paniers en attente</DialogTitle>
    </DialogHeader> -->

    <div class="grid grid-cols-2 gap-6 mt-4">
      <!-- 🧾 Liste des paniers -->
      <div class="border rounded-md overflow-hidden bg-muted/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="text-left">Panier</TableHead>
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
              <TableCell>
                {{
                  cart.clientId
                    ? customerStore.clients.find(c => c.id === cart.clientId)?.firstName ?? 'Client inconnu'
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

        <!-- Bouton -->
        <div class="mt-4">
          <Button class="w-full" :disabled="!selectedCart" @click="handleRecover">
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
  max-width: 80rem !important; /* ≈ 7xl */
}
</style>
