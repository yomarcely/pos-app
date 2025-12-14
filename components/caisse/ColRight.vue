<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Banknote, CreditCard, Printer, Lock } from 'lucide-vue-next'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'
import { useCustomerStore } from '@/stores/customer'
import { useSellersStore } from '@/stores/sellers'
import { useVariationGroupsStore } from '@/stores/variationGroups'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { storeToRefs } from 'pinia'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const cartStore = useCartStore()
const productsStore = useProductsStore()
const customerStore = useCustomerStore()
const sellersStore = useSellersStore()
const variationStore = useVariationGroupsStore()
const { selectedRegisterId } = useEstablishmentRegister()

const payments = ref<{ mode: string; amount: number }[]>([])
const isDayClosed = ref(false)
const currentEstablishment = ref<any>(null)
const registers = ref<any[]>([])
const currentRegister = ref<any>(null)

const { totalTTC, totalHT, totalTVA } = storeToRefs(cartStore)

// Émettre un événement quand le statut des paiements change
const emit = defineEmits<{
  (e: 'payments-changed', hasPayments: boolean): void
}>()

// Watcher pour détecter les changements de paiements
watch(
  () => payments.value.length,
  (newLength) => {
    emit('payments-changed', newLength > 0)
  }
)

// Fonction pour vérifier la clôture
async function checkClosure() {
  if (!selectedRegisterId.value) {
    isDayClosed.value = false
    return
  }

  try {
    const closureCheck = await $fetch('/api/sales/check-closure', {
      params: {
        registerId: selectedRegisterId.value
      }
    })
    isDayClosed.value = closureCheck.isClosed
  } catch (error) {
    console.error('Erreur lors de la vérification de clôture:', error)
    isDayClosed.value = false
  }
}

// Vérifier la clôture au chargement
onMounted(async () => {
  await refreshSelectionsFromStorage()
  await checkClosure()
})

// Revérifier la clôture quand la caisse change
watch(selectedRegisterId, () => {
  checkClosure()
})

const totalPaid = computed(() =>
  payments.value.reduce((sum, p) => sum + p.amount, 0)
)

const balance = computed(() => totalTTC.value - totalPaid.value)

function addPayment(mode: string) {
  // Ne pas permettre d'ajouter un paiement si le mode existe déjà
  if (payments.value.find((p) => p.mode === mode)) return

  // Ne pas permettre d'ajouter un paiement si tout est déjà payé
  if (balance.value <= 0) return

  const newAmount = balance.value > 0 ? balance.value : 0
  payments.value.push({ mode, amount: parseFloat(newAmount.toFixed(2)) })
}

function removePayment(mode: string) {
  payments.value = payments.value.filter((p) => p.mode !== mode)
}

async function refreshSelectionsFromStorage() {
  // Etablissement
  try {
    const savedEstablishmentId = localStorage.getItem('pos_selected_establishment')
    if (savedEstablishmentId) {
      const response = await $fetch<{ success: boolean; establishment: any }>(`/api/establishments/${savedEstablishmentId}`)
      if (response.success) {
        currentEstablishment.value = response.establishment
      }
    } else {
      currentEstablishment.value = null
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'établissement:', error)
    currentEstablishment.value = null
  }

  // Caisses
  try {
    const registersResponse = await $fetch<{ registers: any[] }>('/api/registers')
    registers.value = registersResponse.registers

    const savedRegisterId = localStorage.getItem('pos_selected_register')
    if (savedRegisterId) {
      const register = registers.value.find(r => r.id === Number(savedRegisterId))
      currentRegister.value = register || null
    } else {
      currentRegister.value = null
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la caisse:', error)
    currentRegister.value = null
  }
}

const isSubmitting = ref(false)

async function validerVente() {
  if (isSubmitting.value) return
  isSubmitting.value = true

  // Toujours utiliser la sélection la plus récente
  await refreshSelectionsFromStorage()

  // 0. Vérifier que la journée n'est pas clôturée
  if (isDayClosed.value) {
    toast.error('⚠️ La journée est clôturée. Impossible d\'enregistrer une vente.')
    isSubmitting.value = false
    return
  }

  // 1. Vérifications de base
  if (cartStore.items.length === 0) {
    toast.error('Le panier est vide')
    isSubmitting.value = false
    return
  }

  if (!payments.value.length) {
    toast.error('Aucun mode de paiement sélectionné')
    isSubmitting.value = false
    return
  }

  if (balance.value > 0) {
    toast.error(`Il reste ${balance.value.toFixed(2)} € à payer`)
    isSubmitting.value = false
    return
  }

  // 2. Vérifier qu'un vendeur est sélectionné
  if (!sellersStore.selectedSeller) {
    toast.warning('Veuillez sélectionner un vendeur')
    isSubmitting.value = false
    return
  }

  if (!currentEstablishment.value || !currentEstablishment.value.id) {
    toast.error('Veuillez sélectionner un établissement')
    isSubmitting.value = false
    return
  }

  if (!currentRegister.value || !currentRegister.value.id) {
    toast.error('Veuillez sélectionner une caisse')
    isSubmitting.value = false
    return
  }

  // 3. Confirmation automatique (pas de dialog bloquant)
  const customerName = customerStore.client ? customerStore.clientName : 'Client'
  toast.info(`Vente en cours pour ${customerName} - Total: ${totalTTC.value.toFixed(2)} €`)

  try {
    // 4. Préparer les données pour l'API
    const seller = sellersStore.sellers.find(s => s.id === Number(sellersStore.selectedSeller))

    const findVariationIdByName = (name?: string | null) => {
      if (!name) return null
      for (const group of variationStore.groups) {
        const variation = group.variations.find(v => v.name === name)
        if (variation) return variation.id
      }
      return null
    }

    const saleData = {
      items: cartStore.items.map(item => {
        const finalPrice = cartStore.getFinalPrice(item)
        const variationId = findVariationIdByName(item.variation)
        const variationKey = variationId ? String(variationId) : (item.variation || null)
        return {
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          restockOnReturn: item.restockOnReturn ?? false,
          unitPrice: finalPrice, // Prix après remise
          originalPrice: item.price, // Prix d'origine
          variation: variationKey,
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
      establishmentId: currentEstablishment.value.id,
      registerId: currentRegister.value.id,
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
    const establishment = currentEstablishment.value
    let receipt = `
╔════════════════════════════════════╗
║         TICKET DE CAISSE           ║
╚════════════════════════════════════╝

${establishment ? `${establishment.name}
${establishment.address || ''}
${establishment.postalCode ? `${establishment.postalCode} ` : ''}${establishment.city || ''}
${establishment.phone ? `Tél: ${establishment.phone}` : ''}
${establishment.email ? `Email: ${establishment.email}` : ''}
` : ''}────────────────────────────────────

N° Ticket: ${response.sale.ticketNumber}
Date: ${new Date(response.sale.saleDate).toLocaleString('fr-FR')}
Caisse: ${currentRegister.value?.name || 'N/A'}
Vendeur: ${sellersStore.sellers.find(s => s.id === Number(sellersStore.selectedSeller))?.name || 'N/A'}
${customerStore.client ? `Client: ${customerStore.clientName}\n` : ''}
────────────────────────────────────

ARTICLES:
${cartStore.items.map(item => {
  const finalPrice = cartStore.getFinalPrice(item)
  const hasDiscount = item.discount && item.discount > 0
  let lines = `${item.name} ${item.variation ? `(${item.variation})` : ''}`

  if (hasDiscount) {
    lines += `\n  Prix: ${item.price.toFixed(2)}€ - Remise: ${item.discount}${item.discountType}`
    lines += `\n  ${item.quantity} x ${finalPrice.toFixed(2)}€ = ${(finalPrice * item.quantity).toFixed(2)}€`
  } else {
    lines += `\n  ${item.quantity} x ${finalPrice.toFixed(2)}€ = ${(finalPrice * item.quantity).toFixed(2)}€`
  }

  return lines
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
${establishment ? `
────────────────────────────────────
${establishment.siret ? `SIRET: ${establishment.siret}` : ''}
${establishment.naf ? `NAF: ${establishment.naf}` : ''}
${establishment.tvaNumber ? `TVA: ${establishment.tvaNumber}` : ''}
` : ''}
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
  } finally {
    isSubmitting.value = false
  }
}

// Fonction pour imprimer le ticket (à implémenter)
function printReceipt() {
  toast.info('Fonctionnalité d\'impression à venir')
}
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
        <span v-if="balance < 0" class="text-red-500">
          Rendu : {{ Math.abs(balance).toFixed(2) }} €
        </span>
        <span v-else-if="balance > 0" class="text-orange-500">
          Solde : {{ balance.toFixed(2) }} €
        </span>
      </div>
    </div>

    <!-- 💳 Boutons de paiement -->
    <div class="flex flex-col gap-2 flex-shrink-0" :class="{ 'opacity-50 pointer-events-none': isDayClosed || cartStore.items.length === 0 || balance <= 0 }">
      <label class="text-sm font-semibold">Mode de paiement</label>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" @click="addPayment('Espèces')" :disabled="isDayClosed || cartStore.items.length === 0 || balance <= 0">
          <Banknote class="w-4 h-4 mr-2" /> Espèces
        </Button>
        <Button variant="outline" @click="addPayment('Carte')" :disabled="isDayClosed || cartStore.items.length === 0 || balance <= 0">
          <CreditCard class="w-4 h-4 mr-2" /> Carte
        </Button>
        <Button variant="outline" @click="addPayment('Autre')" :disabled="isDayClosed || cartStore.items.length === 0 || balance <= 0">
          Autre
        </Button>
      </div>
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
        :disabled="isSubmitting || totalPaid < totalTTC || cartStore.items.length === 0 || isDayClosed"
      >
        <Spinner class="size-4 mr-2" v-if="isSubmitting" />
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
  </div>
</template>
