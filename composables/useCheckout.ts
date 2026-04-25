import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'
import { useCustomerStore } from '@/stores/customer'
import { useSellersStore } from '@/stores/sellers'
import { useVariationGroupsStore } from '@/stores/variationGroups'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useToast } from '@/composables/useToast'
import { extractFetchError } from '@/composables/useFetchError'

export interface Payment {
  mode: string
  amount: number
}

/**
 * Logique du tunnel de validation de vente extraite de ColRight.vue.
 * Gère paiements, vérification clôture journée, validation et soumission de la vente.
 */
export function useCheckout() {
  const cartStore = useCartStore()
  const productsStore = useProductsStore()
  const customerStore = useCustomerStore()
  const sellersStore = useSellersStore()
  const variationStore = useVariationGroupsStore()
  const { selectedRegisterId, selectedRegister, selectedEstablishmentDetail } = useEstablishmentRegister()
  const toast = useToast()

  const { totalTTC, totalHT, totalTVA } = storeToRefs(cartStore)

  const payments = ref<Payment[]>([])
  const isSubmitting = ref(false)
  const isDayClosed = ref(false)

  const totalPaid = computed(() => payments.value.reduce((sum, p) => sum + p.amount, 0))
  const balance = computed(() => totalTTC.value - totalPaid.value)

  async function checkClosure() {
    if (!selectedRegisterId.value) {
      isDayClosed.value = false
      return
    }
    try {
      isDayClosed.value = await cartStore.checkDayClosure(selectedRegisterId.value)
    }
    catch (error) {
      console.error('Erreur lors de la vérification de clôture:', error)
      isDayClosed.value = false
    }
  }

  function addPayment(mode: string) {
    if (payments.value.find(p => p.mode === mode)) return
    if (totalTTC.value > 0 && balance.value <= 0) return
    if (totalTTC.value < 0 && balance.value >= 0) return
    if (totalTTC.value === 0) return

    payments.value.push({ mode, amount: parseFloat(balance.value.toFixed(2)) })
  }

  function removePayment(mode: string) {
    payments.value = payments.value.filter(p => p.mode !== mode)
  }

  function findVariationIdByName(name?: string | null): number | string | null {
    if (!name) return null
    for (const group of variationStore.groups) {
      const variation = group.variations.find(v => v.name === name)
      if (variation) return variation.id
    }
    return null
  }

  async function validerVente() {
    if (isSubmitting.value) return
    isSubmitting.value = true

    try {
      if (isDayClosed.value) {
        toast.error('⚠️ La journée est clôturée. Impossible d\'enregistrer une vente.')
        return
      }

      if (cartStore.items.length === 0) {
        toast.error('Le panier est vide')
        return
      }

      if (totalTTC.value !== 0 && !payments.value.length) {
        toast.error('Aucun mode de paiement sélectionné')
        return
      }

      if (totalTTC.value > 0 && balance.value > 0) {
        toast.error(`Il reste ${balance.value.toFixed(2)} € à payer`)
        return
      }

      if (totalTTC.value < 0 && balance.value < 0) {
        toast.error(`Il reste ${Math.abs(balance.value).toFixed(2)} € à rembourser`)
        return
      }

      if (!sellersStore.selectedSeller) {
        toast.warning('Veuillez sélectionner un vendeur')
        return
      }

      const establishment = selectedEstablishmentDetail.value
      if (!establishment?.id) {
        toast.error('Veuillez sélectionner un établissement')
        return
      }

      const register = selectedRegister.value
      if (!register?.id) {
        toast.error('Veuillez sélectionner une caisse')
        return
      }

      const stockCheck = cartStore.validateStock()
      if (!stockCheck.valid) {
        toast.warning('Stock insuffisant pour certains articles — la vente continue')
      }

      const customerName = customerStore.client ? customerStore.clientName : 'Client'
      toast.info(`Vente en cours pour ${customerName} - Total: ${totalTTC.value.toFixed(2)} €`)

      const seller = sellersStore.sellers.find(s => s.id === Number(sellersStore.selectedSeller))

      const saleData = {
        items: cartStore.items.map((item) => {
          const finalPrice = cartStore.getFinalPrice(item)
          const variationId = findVariationIdByName(item.variation)
          const variationKey = variationId ? String(variationId) : (item.variation || null)
          return {
            productId: item.id,
            productName: item.name,
            quantity: item.quantity,
            restockOnReturn: item.restockOnReturn ?? false,
            unitPrice: finalPrice,
            originalPrice: item.price,
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
        customer: customerStore.client
          ? {
              id: Number(customerStore.client.id),
              firstName: customerStore.client.firstName,
              lastName: customerStore.client.lastName,
            }
          : null,
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
        establishmentId: establishment.id,
        registerId: register.id,
      }

      const response = await cartStore.submitSale(saleData)

      if (!response.success) {
        throw new Error('Échec de l\'enregistrement de la vente')
      }

      productsStore.loaded = false
      await productsStore.loadProducts()

      toast.success('Vente enregistrée avec succès !')

      cartStore.clearCart()
      customerStore.clearClient()
      payments.value = []
    }
    catch (error) {
      const message = extractFetchError(error, 'Erreur lors de la validation de la vente')
      console.error('Erreur lors de la validation:', error)
      toast.error(message)
    }
    finally {
      isSubmitting.value = false
    }
  }

  onMounted(() => { checkClosure() })
  watch(selectedRegisterId, () => { checkClosure() })

  return {
    payments,
    isSubmitting,
    isDayClosed,
    totalPaid,
    balance,
    totalTTC,
    totalHT,
    totalTVA,
    addPayment,
    removePayment,
    validerVente,
    checkClosure,
  }
}
