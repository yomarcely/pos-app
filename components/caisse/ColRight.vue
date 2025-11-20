<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Banknote, CreditCard, Printer, Lock } from 'lucide-vue-next'
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'
import { useCustomerStore } from '@/stores/customer'
import { useSellersStore } from '@/stores/sellers'
import { storeToRefs } from 'pinia'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const cartStore = useCartStore()
const productsStore = useProductsStore()
const customerStore = useCustomerStore()
const sellersStore = useSellersStore()

const payments = ref<{ mode: string; amount: number }[]>([])
const isDayClosed = ref(false)

const { totalTTC, totalHT, totalTVA } = storeToRefs(cartStore)

// Vérifier si la journée est clôturée au chargement
onMounted(async () => {
  try {
    const closureCheck = await $fetch('/api/sales/check-closure')
    if (closureCheck.isClosed) {
      isDayClosed.value = true
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de clôture:', error)
  }
})

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

async function validerVente() {
  // 0. Vérifier que la journée n'est pas clôturée
  if (isDayClosed.value) {
    toast.error('⚠️ La journée est clôturée. Impossible d\'enregistrer une vente.')
    return
  }

  // 1. Vérifications de base
  if (cartStore.items.length === 0) {
    toast.error('Le panier est vide')
    return
  }

  if (!payments.value.length) {
    toast.error('Aucun mode de paiement sélectionné')
    return
  }

  if (balance.value > 0) {
    toast.error(`Il reste ${balance.value.toFixed(2)} € à payer`)
    return
  }

  // 2. Vérifier qu'un vendeur est sélectionné
  if (!sellersStore.selectedSeller) {
    toast.warning('Veuillez sélectionner un vendeur')
    return
  }

  // 3. Confirmation automatique (pas de dialog bloquant)
  const customerName = customerStore.client ? customerStore.clientName : 'Client'
  toast.info(`Vente en cours pour ${customerName} - Total: ${totalTTC.value.toFixed(2)} €`)

  try {
    // 4. Préparer les données pour l'API
    const seller = sellersStore.sellers.find(s => s.id === Number(sellersStore.selectedSeller))

    const saleData = {
      items: cartStore.items.map(item => {
        const finalPrice = cartStore.getFinalPrice(item)
        return {
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: finalPrice,
          variation: item.variation || '',
          discount: item.discount,
          discountType: item.discountType,
          tva: item.tva || 20,
        }
      }),
      seller: {
        id: Number(sellersStore.selectedSeller),
        name: seller?.name || 'Vendeur inconnu',
      },
      customer: customerStore.client ? {
        id: customerStore.client.id,
        firstName: customerStore.client.name,
        lastName: customerStore.client.lastname,
      } : null,
      payments: payments.value,
      totals: {
        totalHT: totalHT.value,
        totalTVA: totalTVA.value,
        totalTTC: totalTTC.value,
      },
      globalDiscount: {
        value: cartStore.globalDiscount,
        type: cartStore.globalDiscountType,
      },
    }

    // 5. Envoyer à l'API (NF525)
    const response = await $fetch('/api/sales/create', {
      method: 'POST',
      body: saleData,
    })

    if (!response.success) {
      throw new Error('Échec de l\'enregistrement de la vente')
    }

    // 6. Recharger les produits depuis la base de données pour avoir les stocks à jour
    productsStore.loaded = false
    await productsStore.loadProducts()

    console.log('✅ Vente NF525 enregistrée :', response.sale)

    // 7. Afficher le récapitulatif
    let receipt = `
╔════════════════════════════════════╗
║         TICKET DE CAISSE           ║
╚════════════════════════════════════╝

N° Ticket: ${response.sale.ticketNumber}
Date: ${new Date(response.sale.saleDate).toLocaleString('fr-FR')}
Vendeur: ${sellersStore.sellers.find(s => s.id === Number(sellersStore.selectedSeller))?.name || 'N/A'}
${customerStore.client ? `Client: ${customerStore.clientName}\n` : ''}
────────────────────────────────────

ARTICLES:
${cartStore.items.map(item => {
  const finalPrice = cartStore.getFinalPrice(item)
  return `${item.name} ${item.variation ? `(${item.variation})` : ''}
  ${item.quantity} x ${finalPrice.toFixed(2)}€ = ${(finalPrice * item.quantity).toFixed(2)}€`
}).join('\n')}

────────────────────────────────────
Total HT:     ${totalHT.value.toFixed(2)} €
TVA:          ${totalTVA.value.toFixed(2)} €
Total TTC:    ${totalTTC.value.toFixed(2)} €

PAIEMENTS:
${payments.value.map(p => `${p.mode}: ${p.amount.toFixed(2)} €`).join('\n')}

${balance.value < 0 ? `Rendu: ${Math.abs(balance.value).toFixed(2)} €\n` : ''}
════════════════════════════════════

Hash NF525: ${response.sale.hash.substring(0, 16)}...
Signature: ${response.sale.signature?.substring(0, 16) || 'TEMP'}...

Merci de votre visite !
    `

    console.log(receipt)
    toast.success('Vente enregistrée avec succès !', 'Consultez la console pour le ticket')

    // 9. Nettoyer
    cartStore.clearCart()
    customerStore.clearClient()
    payments.value = []

  } catch (error) {
    console.error('Erreur lors de la validation:', error)
    toast.error('Une erreur est survenue lors de la validation de la vente')
  }
}

// Fonction pour imprimer le ticket (à implémenter)
function printReceipt() {
  toast.info('Fonctionnalité d\'impression à venir')
}
</script>

<template>
  <div class="space-y-4">
    <!-- ⚠️ Message de journée clôturée -->
    <div v-if="isDayClosed" class="p-4 border-2 border-red-500 rounded-lg bg-red-50 dark:bg-red-950">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-300">
        <Lock class="w-5 h-5" />
        <div>
          <div class="font-semibold">Journée clôturée</div>
          <div class="text-sm">Les ventes ne peuvent plus être enregistrées pour aujourd'hui.</div>
        </div>
      </div>
    </div>

    <!-- 💰 Montant total -->
    <div class="relative rounded-lg w-full h-50 shadow bg-gray-900 text-white dark:bg-white dark:text-black p-4" :class="{ 'opacity-50': isDayClosed }">
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
    <div class="space-y-2" :class="{ 'opacity-50 pointer-events-none': isDayClosed }">
      <label class="text-sm font-semibold">Mode de paiement</label>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" @click="addPayment('Espèces')" :disabled="isDayClosed">
          <Banknote class="w-4 h-4 mr-2" /> Espèces
        </Button>
        <Button variant="outline" @click="addPayment('Carte')" :disabled="isDayClosed">
          <CreditCard class="w-4 h-4 mr-2" /> Carte
        </Button>
        <Button variant="outline" @click="addPayment('Autre')" :disabled="isDayClosed">
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
  <div class="pt-4 space-y-2">
    <Button
      class="w-full text-lg font-semibold"
      @click="validerVente"
      :disabled="totalPaid < totalTTC || cartStore.items.length === 0 || isDayClosed"
    >
      <Lock v-if="isDayClosed" class="w-4 h-4 mr-2" />
      {{ isDayClosed ? 'Journée clôturée' : 'Valider la vente' }}
    </Button>
    
    <!-- <Button 
      variant="outline" 
      class="w-full" 
      @click="printReceipt"
      :disabled="cartStore.items.length === 0"
    >
      <Printer class="w-4 h-4 mr-2" />
      Imprimer ticket
    </Button> -->
  </div>
</template>