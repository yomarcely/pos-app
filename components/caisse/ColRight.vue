<script setup lang="ts">
import { watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Banknote, CreditCard, Lock } from 'lucide-vue-next'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import SaleSuccessDialog from '@/components/caisse/SaleSuccessDialog.vue'
import { useCartStore } from '@/stores/cart'
import { useCheckout } from '@/composables/useCheckout'
import { usePrintDocument } from '@/composables/usePrintDocument'
import { buildReceiptHtml, buildInvoiceHtml } from '@/utils/saleDocuments'

const cartStore = useCartStore()
const { printHtml } = usePrintDocument()

const {
  payments,
  isSubmitting,
  isDayClosed,
  balance,
  totalTTC,
  totalHT,
  totalTVA,
  lastSaleDocument,
  showSuccessDialog,
  addPayment,
  removePayment,
  validerVente,
} = useCheckout()

const emit = defineEmits<{
  (e: 'payments-changed', hasPayments: boolean): void
}>()

watch(
  () => payments.value.length,
  newLength => emit('payments-changed', newLength > 0),
)

async function handlePrintReceipt() {
  if (!lastSaleDocument.value) return
  await printHtml(buildReceiptHtml(lastSaleDocument.value))
}

async function handlePrintInvoice() {
  if (!lastSaleDocument.value) return
  await printHtml(buildInvoiceHtml(lastSaleDocument.value))
}

function closeSuccessDialog() {
  showSuccessDialog.value = false
}

defineExpose({
  payments,
  addPayment,
  removePayment,
  validerVente,
  showSuccessDialog,
  lastSaleDocument,
})
</script>

<template>
  <div class="h-full flex flex-col gap-4">
    <!-- ⚠️ Message de journée clôturée -->
    <div v-if="isDayClosed" class="p-4 border-2 border-red-500 rounded-lg bg-red-50 dark:bg-red-950 flex-shrink-0">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-300">
        <Lock class="w-5 h-5" />
        <div>
          <div class="font-semibold">Journée clôturée</div>
          <div class="text-sm">Les ventes ne peuvent plus être enregistrées pour aujourd'hui.</div>
        </div>
      </div>
    </div>

    <!-- 💰 Montant total -->
    <div class="relative rounded-lg w-full h-50 shadow bg-gray-900 text-white dark:bg-white dark:text-black p-4 flex-shrink-0" :class="{ 'opacity-50': isDayClosed }">
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
        <span v-if="totalTTC >= 0 && balance < 0" class="text-red-500">
          Rendu : {{ Math.abs(balance).toFixed(2) }} €
        </span>
        <span v-else-if="totalTTC >= 0 && balance > 0" class="text-orange-500">
          Solde : {{ balance.toFixed(2) }} €
        </span>
        <span v-else-if="totalTTC < 0 && balance < 0" class="text-orange-500">
          Reste à rembourser : {{ Math.abs(balance).toFixed(2) }} €
        </span>
        <span v-else-if="totalTTC < 0 && balance > 0" class="text-red-500">
          Trop remboursé : {{ balance.toFixed(2) }} €
        </span>
      </div>
    </div>

    <!-- 💳 Boutons de paiement -->
    <div v-if="totalTTC !== 0" class="flex flex-col gap-2 flex-shrink-0" :class="{ 'opacity-50 pointer-events-none': isDayClosed || cartStore.items.length === 0 || (totalTTC > 0 && balance <= 0) || (totalTTC < 0 && balance >= 0) }">
      <label class="text-sm font-semibold">Mode de {{ totalTTC < 0 ? 'remboursement' : 'paiement' }}</label>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" @click="addPayment('Espèces')" :disabled="isDayClosed || cartStore.items.length === 0 || (totalTTC > 0 && balance <= 0) || (totalTTC < 0 && balance >= 0)">
          <Banknote class="w-4 h-4 mr-2" /> Espèces
        </Button>
        <Button variant="outline" @click="addPayment('Carte')" :disabled="isDayClosed || cartStore.items.length === 0 || (totalTTC > 0 && balance <= 0) || (totalTTC < 0 && balance >= 0)">
          <CreditCard class="w-4 h-4 mr-2" /> Carte
        </Button>
        <Button variant="outline" @click="addPayment('Autre')" :disabled="isDayClosed || cartStore.items.length === 0 || (totalTTC > 0 && balance <= 0) || (totalTTC < 0 && balance >= 0)">
          Autre
        </Button>
      </div>
    </div>

    <!-- Message pour les échanges (total = 0) -->
    <div v-else-if="totalTTC === 0 && cartStore.items.length > 0" class="p-3 border rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-sm flex-shrink-0">
      <div class="font-semibold mb-1">Échange de produits</div>
      <div class="text-xs">Aucun paiement requis - Validation pour mouvements de stock uniquement</div>
    </div>

    <!-- 📦 Paiements sélectionnés -->
    <div v-if="payments.length > 0" class="flex flex-col gap-2 flex-shrink-0">
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

    <!-- ✅ Bouton de validation -->
    <div class="mt-auto pt-4 flex flex-col gap-4 flex-shrink-0">
      <!-- Remise globale (placée juste au-dessus du bouton de validation) -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-semibold">Remise globale</label>
        <div class="flex gap-2">
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
          class="w-full"
          @click="cartStore.applyGlobalDiscountToItems()"
          :disabled="cartStore.items.length === 0 || cartStore.globalDiscount === 0"
        >
          Appliquer la remise
        </Button>
      </div>

      <Button
        class="w-full text-lg font-semibold h-12"
        @click="validerVente"
        :disabled="isSubmitting || (totalTTC > 0 && balance > 0) || (totalTTC < 0 && balance < 0) || cartStore.items.length === 0 || isDayClosed"
      >
        <Spinner class="size-4 mr-2" v-if="isSubmitting" />
        <Lock v-if="isDayClosed" class="w-4 h-4 mr-2" />
        {{ isDayClosed ? 'Journée clôturée' : (totalTTC === 0 ? 'Valider l\'échange' : (totalTTC < 0 ? 'Valider le remboursement' : 'Valider la vente')) }}
      </Button>

    </div>

    <SaleSuccessDialog
      :open="showSuccessDialog"
      :ticket-number="lastSaleDocument?.ticketNumber"
      @update:open="(v) => (showSuccessDialog = v)"
      @print-receipt="handlePrintReceipt"
      @print-invoice="handlePrintInvoice"
      @close="closeSuccessDialog"
    />
  </div>
</template>
