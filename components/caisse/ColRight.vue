<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Banknote, CreditCard, Lock, AlertCircle } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import SaleSuccessDialog from '@/components/caisse/SaleSuccessDialog.vue'
import LoyaltyRewardDialog from '@/components/caisse/LoyaltyRewardDialog.vue'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { useCheckout } from '@/composables/useCheckout'
import { useLoyaltyForCustomer } from '@/composables/useLoyaltyForCustomer'
import { usePrintDocument } from '@/composables/usePrintDocument'
import { useAutoPrintPreference } from '@/composables/useAutoPrintPreference'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { buildReceiptHtml, buildInvoiceHtml } from '@/utils/saleDocuments'

const cartStore = useCartStore()
const customerStore = useCustomerStore()
const { printHtml } = usePrintDocument()
const { autoPrint } = useAutoPrintPreference()
const { selectedEstablishmentId, selectedRegisterId } = useEstablishmentRegister()
const {
  status: loyaltyStatus,
  fetchStatus,
  reset: resetLoyaltyStatus,
  isEligibleForReward,
  isRewardApplied,
  applyReward,
} = useLoyaltyForCustomer()

// Modale d'avantage à la sélection client (proposition automatique)
const loyaltyDialogOpen = ref(false)
const loyaltyDialogCustomerName = ref('')
const loyaltyDialogPointsRequired = computed(() => loyaltyStatus.value?.pointsRequired ?? 0)
const loyaltyDialogRewardType = computed(() => loyaltyStatus.value?.rewardType ?? 'percent_discount')
const loyaltyDialogRewardValue = computed(() => loyaltyStatus.value?.rewardValue ?? 0)

const {
  payments,
  isSubmitting,
  isRetrying,
  isDayClosed,
  showErrorDialog,
  errorDialogMessage,
  errorDialogTotal,
  retryFromErrorDialog,
  closeErrorDialog,
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

// Impression « brute » (sans audit) — utilisée par l'impression automatique.
async function printReceipt() {
  if (!lastSaleDocument.value) return
  await printHtml(buildReceiptHtml(lastSaleDocument.value))
}

async function printInvoice() {
  if (!lastSaleDocument.value) return
  await printHtml(buildInvoiceHtml(lastSaleDocument.value))
}

// Réimpressions MANUELLES depuis le dialog : tracées dans l'audit NF525.
async function handlePrintReceipt() {
  await printReceipt()
  await logReprint('receipt')
}

async function handlePrintInvoice() {
  await printInvoice()
  await logReprint('invoice')
}

async function logReprint(documentType: 'receipt' | 'invoice') {
  const doc = lastSaleDocument.value
  if (!doc?.ticketNumber) return
  try {
    await $fetch('/api/sales/reprint', {
      method: 'POST',
      body: {
        ticketNumber: doc.ticketNumber,
        documentType,
        establishmentId: selectedEstablishmentId.value ?? undefined,
        registerId: selectedRegisterId.value ?? undefined,
      },
    })
  }
  catch (error) {
    // L'échec d'audit ne doit pas perturber l'utilisateur : l'impression a eu lieu.
    console.error('Erreur lors de l\'enregistrement de la réimpression', error)
  }
}

// Impression automatique du ticket à l'ouverture du dialog de succès (si activée).
// Première impression = impression d'origine, donc NON tracée comme réimpression.
watch(showSuccessDialog, (open) => {
  if (open && autoPrint.value) {
    void printReceipt().catch(err => console.error('Impression automatique échouée', err))
  }
})

function closeSuccessDialog() {
  showSuccessDialog.value = false
}

// ===========================================
// Fidélité : charge le statut à la sélection d'un client + propose la modale si éligible.
// L'application/retrait peut aussi se faire via l'étoile dans ColLeft (singleton useLoyaltyForCustomer).
// ===========================================
watch(() => customerStore.client, async (client) => {
  if (!client || !selectedEstablishmentId.value) {
    resetLoyaltyStatus()
    loyaltyDialogOpen.value = false
    return
  }
  try {
    await fetchStatus(client.id, selectedEstablishmentId.value)
    // Proposition automatique : si éligible et pas déjà appliqué, ouvrir la modale
    if (isEligibleForReward.value && !isRewardApplied.value) {
      loyaltyDialogCustomerName.value = `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() || 'Client'
      loyaltyDialogOpen.value = true
    }
  }
  catch (error) {
    console.error('Erreur lors du chargement du statut fidélité', error)
  }
})

function applyLoyaltyFromDialog() {
  applyReward()
  loyaltyDialogOpen.value = false
}

function declineLoyaltyDialog() {
  loyaltyDialogOpen.value = false
}

defineExpose({
  payments,
  addPayment,
  removePayment,
  validerVente,
  // Exposés pour les raccourcis clavier (useCaisseShortcuts, monté sur la page)
  balance,
  isSubmitting,
  isDayClosed,
  showSuccessDialog,
  showErrorDialog,
  errorDialogMessage,
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
    <div v-if="totalTTC !== 0" class="flex flex-col gap-2 flex-shrink-0" :class="{ 'opacity-50 pointer-events-none': isSubmitting || isDayClosed || cartStore.items.length === 0 || (totalTTC > 0 && balance <= 0) || (totalTTC < 0 && balance >= 0) }">
      <label class="text-sm font-semibold">Mode de {{ totalTTC < 0 ? 'remboursement' : 'paiement' }}</label>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" @click="addPayment('Espèces')" :disabled="isSubmitting || isDayClosed || cartStore.items.length === 0 || (totalTTC > 0 && balance <= 0) || (totalTTC < 0 && balance >= 0)">
          <Banknote class="w-4 h-4 mr-2" /> Espèces
          <kbd class="ml-1.5 text-[10px] font-normal text-muted-foreground">F1</kbd>
        </Button>
        <Button variant="outline" @click="addPayment('Carte')" :disabled="isSubmitting || isDayClosed || cartStore.items.length === 0 || (totalTTC > 0 && balance <= 0) || (totalTTC < 0 && balance >= 0)">
          <CreditCard class="w-4 h-4 mr-2" /> Carte
          <kbd class="ml-1.5 text-[10px] font-normal text-muted-foreground">F2</kbd>
        </Button>
        <Button variant="outline" @click="addPayment('Autre')" :disabled="isSubmitting || isDayClosed || cartStore.items.length === 0 || (totalTTC > 0 && balance <= 0) || (totalTTC < 0 && balance >= 0)">
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
        :class="{ 'opacity-50': isSubmitting }"
      >
        <button class="absolute top-2 right-2 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:pointer-events-none" :disabled="isSubmitting" @click="removePayment(payment.mode)">
          <X class="w-4 h-4" />
        </button>
        <div class="text-sm font-semibold mb-2">{{ payment.mode }}</div>
        <Input v-model.number="payment.amount" type="number" class="w-full text-right" min="0" step="0.01" :disabled="isSubmitting" />
      </div>
    </div>

    <!-- ✅ Bouton de validation -->
    <div class="mt-auto pt-4 flex flex-col gap-4 flex-shrink-0">
      <!-- Remise globale (placée juste au-dessus du bouton de validation) -->
      <div class="flex flex-col gap-2" :class="{ 'opacity-50': isSubmitting }">
        <label class="text-sm font-semibold">Remise globale</label>
        <div class="flex gap-2">
          <Input type="number" min="0" placeholder="0" class="w-full" v-model.number="cartStore.globalDiscount" :disabled="isSubmitting" />
          <Select v-model="cartStore.globalDiscountType" :disabled="isSubmitting">
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
          :disabled="isSubmitting || cartStore.items.length === 0 || cartStore.globalDiscount === 0"
        >
          Appliquer la remise
        </Button>
      </div>

      <Button
        class="w-full text-lg font-semibold h-12"
        :class="{ 'opacity-50': isSubmitting }"
        @click="validerVente"
        :disabled="isSubmitting || (totalTTC > 0 && balance > 0) || (totalTTC < 0 && balance < 0) || cartStore.items.length === 0 || isDayClosed"
      >
        <Spinner class="size-4 mr-2" v-if="isSubmitting" />
        <Lock v-if="isDayClosed" class="w-4 h-4 mr-2" />
        {{ isDayClosed ? 'Journée clôturée' : (isRetrying ? 'Nouvelle tentative…' : (totalTTC === 0 ? 'Valider l\'échange' : (totalTTC < 0 ? 'Valider le remboursement' : 'Valider la vente'))) }}
        <kbd v-if="!isDayClosed && !isSubmitting" class="ml-2 text-[10px] font-normal opacity-70">F10</kbd>
      </Button>

    </div>

    <!-- ❌ Échec de validation : modal bloquant, le panier reste intact -->
    <Dialog :open="showErrorDialog" @update:open="(v) => { if (!v) closeErrorDialog() }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <div class="flex flex-col items-center gap-3 pt-2">
            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
              <AlertCircle class="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle class="text-center text-xl">Échec de la validation</DialogTitle>
            <DialogDescription class="text-center">
              {{ errorDialogMessage }}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div class="py-2 text-center">
          <div class="text-sm text-muted-foreground">Total du panier</div>
          <div class="text-2xl font-bold">{{ errorDialogTotal.toFixed(2) }} €</div>
          <div class="mt-2 text-xs text-muted-foreground">Le panier et les paiements ont été conservés.</div>
        </div>
        <DialogFooter class="gap-2 sm:gap-2">
          <Button variant="outline" class="w-full sm:w-auto" @click="closeErrorDialog">
            Fermer
          </Button>
          <Button class="w-full sm:w-auto" @click="retryFromErrorDialog">
            Réessayer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SaleSuccessDialog
      :open="showSuccessDialog"
      :ticket-number="lastSaleDocument?.ticketNumber"
      :auto-print="autoPrint"
      @update:open="(v) => (showSuccessDialog = v)"
      @update:auto-print="(v) => (autoPrint = v)"
      @print-receipt="handlePrintReceipt"
      @print-invoice="handlePrintInvoice"
      @close="closeSuccessDialog"
    />

    <LoyaltyRewardDialog
      :open="loyaltyDialogOpen"
      :customer-name="loyaltyDialogCustomerName"
      :points-current="loyaltyStatus?.pointsCurrent ?? 0"
      :points-required="loyaltyDialogPointsRequired"
      :reward-type="loyaltyDialogRewardType"
      :reward-value="loyaltyDialogRewardValue"
      @update:open="(v) => (loyaltyDialogOpen = v)"
      @apply="applyLoyaltyFromDialog"
      @decline="declineLoyaltyDialog"
    />
  </div>
</template>
