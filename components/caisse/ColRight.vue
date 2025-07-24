<script setup lang="ts">
import { ref, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Banknote, CreditCard } from 'lucide-vue-next'
import { useCartStore } from '@/stores/cart'

const cartStore = useCartStore()

const payments = ref<{ mode: string; amount: number }[]>([])

const totalTTC = computed(() => cartStore.totalTTC)
const totalHT = computed(() => cartStore.totalHT)
const totalTVA = computed(() => cartStore.totalTVA)

const totalPaid = computed(() =>
  payments.value.reduce((sum, p) => sum + p.amount, 0)
)

const balance = computed(() => totalTTC.value - totalPaid.value)

function addPayment(mode: string) {
  if (payments.value.find((p) => p.mode === mode)) return
  const newAmount = balance.value > 0 ? balance.value : 0
  payments.value.push({ mode, amount: parseFloat(newAmount.toFixed(2)) })
}

function removePayment(mode: string) {
  payments.value = payments.value.filter((p) => p.mode !== mode)
}

function validerVente() {
  if (!payments.value.length) {
    alert('Aucun mode de paiement sélectionné.')
    return
  }

  if (balance.value > 0) {
    alert(`Il reste ${balance.value.toFixed(2)} € à payer.`)
    return
  }

  console.log('✅ Vente validée :', {
    items: cartStore.items,
    total: totalTTC.value,
    payments: payments.value,
  })

  cartStore.clearCart()
  payments.value = []
}
</script>

<template>
  <div class="space-y-4">
    <!-- 💰 Montant total -->
    <div class="relative rounded-lg w-full h-50 shadow bg-gray-900 text-white dark:bg-white dark:text-black p-4">
      <div class="absolute top-2 left-4 text-xl font-medium text-gray-400 dark:text-black">
        Total TTC
      </div>
      <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div class="text-5xl font-bold text-white dark:text-black">
          {{ totalTTC.toFixed(2) }} €
        </div>
      </div>
      <div class="absolute bottom-8 right-4 text-sm text-gray-400 dark:text-gray-600">
        TVA : {{ totalTVA.toFixed(2) }} €
      </div>
      <div class="absolute bottom-2 right-4 text-sm text-gray-400 dark:text-gray-600">
        HT : {{ totalHT.toFixed(2) }} €
      </div>
      <div class="absolute bottom-2 left-4 text-sm font-semibold">
        <span v-if="balance < 0" class="text-red-500">
          Rendu : {{ Math.abs(balance).toFixed(2) }} €
        </span>
        <span v-else-if="balance > 0" class="text-orange-500">
          Solde : {{ balance.toFixed(2) }} €
        </span>
      </div>
    </div>

    <!-- 💳 Boutons de paiement -->
    <div class="space-y-2">
      <label class="text-sm font-semibold">Mode de paiement</label>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" @click="addPayment('Espèces')">
          <Banknote class="w-4 h-4 mr-2" /> Espèces
        </Button>
        <Button variant="outline" @click="addPayment('Carte')">
          <CreditCard class="w-4 h-4 mr-2" /> Carte
        </Button>
        <Button variant="outline" @click="addPayment('Autre')">
          Autre
        </Button>
      </div>
    </div>

    <!-- 📦 Paiements sélectionnés -->
    <div v-if="payments.length > 0" class="space-y-2">
      <div
        v-for="payment in payments"
        :key="payment.mode"
        class="relative p-3 border rounded-md bg-white dark:bg-gray-900 shadow-sm"
      >
        <button class="absolute top-2 right-2 text-red-500 hover:text-red-700" @click="removePayment(payment.mode)">
          <X class="w-4 h-4" />
        </button>
        <div class="text-sm font-semibold mb-2">{{ payment.mode }}</div>
        <Input v-model.number="payment.amount" type="number" class="w-full text-right" min="0" step="0.01" />
      </div>
    </div>
  </div>

  <!-- ✅ Bouton de validation -->
  <div class="pt-4">
    <Button class="w-full text-lg font-semibold" @click="validerVente">
      Valider la vente
    </Button>
  </div>
</template>
