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
import { useAuthStore } from '@/stores/auth'
import type { SaleDocumentData } from '@/utils/saleDocuments'
import {
  paymentsStorageKey,
  readPersisted,
  writePersisted,
  purgePersisted,
} from '@/utils/cartPersistence'

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
  const lastSaleDocument = ref<SaleDocumentData | null>(null)
  const showSuccessDialog = ref(false)

  // Échec de soumission : dialog bloquant (le panier reste intact, voir validerVente)
  const showErrorDialog = ref(false)
  const errorDialogMessage = ref('')
  const errorDialogTotal = ref(0)

  // Retry réseau/5xx de la soumission uniquement (idempotente via clientSaleId).
  // retryAttempt > 0 → le bouton affiche "Nouvelle tentative…".
  const retryAttempt = ref(0)
  const isRetrying = computed(() => retryAttempt.value > 0)
  const RETRY_DELAYS_MS = [1000, 2000, 4000]

  function isRetryableError(error: unknown): boolean {
    const e = error as { statusCode?: number; response?: { status?: number } } | null
    const status = e?.statusCode ?? e?.response?.status
    if (status === undefined) return true // erreur réseau (pas de réponse HTTP)
    return status >= 500
  }

  async function submitSaleWithRetry(saleData: Parameters<typeof cartStore.submitSale>[0]) {
    retryAttempt.value = 0
    for (;;) {
      try {
        return await cartStore.submitSale(saleData)
      }
      catch (error) {
        if (!isRetryableError(error) || retryAttempt.value >= RETRY_DELAYS_MS.length) {
          throw error
        }
        const delay = RETRY_DELAYS_MS[retryAttempt.value]
        retryAttempt.value += 1
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // Total payé = paiements saisis (espèces/carte/autre) + montants des bons d'achat appliqués.
  // Les vouchers réduisent la somme à payer manuellement.
  const totalVouchers = computed(() =>
    cartStore.appliedVouchers.reduce((sum, v) => sum + v.amount, 0),
  )
  const totalPaid = computed(() =>
    payments.value.reduce((sum, p) => sum + p.amount, 0) + totalVouchers.value,
  )
  const balance = computed(() => totalTTC.value - totalPaid.value)

  // --- PERSISTANCE DES PAIEMENTS EN COURS ---
  // Même pattern que le panier (stores/cart.ts) mais clé dédiée : les paiements vivent
  // dans ce composable (instance unique, ColRight) — les persister ici évite de migrer
  // leur état vers le store. Purge naturelle : payments = [] après vente → purge de la clé.
  function paymentsKey(): string | null {
    try {
      const tenantId = useAuthStore().tenantId
      if (!tenantId || !selectedRegisterId.value) return null
      return paymentsStorageKey(tenantId, selectedRegisterId.value)
    } catch {
      return null
    }
  }

  let paymentsSaveTimer: ReturnType<typeof setTimeout> | null = null
  let paymentsRestored = false

  function persistPaymentsNow() {
    const key = paymentsKey()
    if (!key) return
    if (payments.value.length === 0) {
      purgePersisted(key)
      return
    }
    writePersisted(key, payments.value)
  }

  watch(payments, () => {
    if (paymentsSaveTimer) clearTimeout(paymentsSaveTimer)
    paymentsSaveTimer = setTimeout(persistPaymentsNow, 300)
  }, { deep: true })

  // Restaure les paiements persistés (une seule tentative effective, quand tenant+caisse connus)
  function tryRestorePayments() {
    if (paymentsRestored) return
    const key = paymentsKey()
    if (!key) return
    paymentsRestored = true

    const saved = readPersisted<Payment[]>(key)
    if (!Array.isArray(saved)) {
      if (saved !== null) purgePersisted(key)
      return
    }
    const valid = saved.filter(p => p && typeof p.mode === 'string' && typeof p.amount === 'number')
    if (valid.length) payments.value = valid
  }

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
    if (isSubmitting.value) return
    if (payments.value.find(p => p.mode === mode)) return
    if (totalTTC.value > 0 && balance.value <= 0) return
    if (totalTTC.value < 0 && balance.value >= 0) return
    if (totalTTC.value === 0) return

    payments.value.push({ mode, amount: parseFloat(balance.value.toFixed(2)) })
  }

  function removePayment(mode: string) {
    if (isSubmitting.value) return
    payments.value = payments.value.filter(p => p.mode !== mode)
  }

  /**
   * Fallback pour les items de paniers persistés avant l'introduction de
   * variationId : résolution du nom parmi les variations DU produit (jamais
   * en interprétant le nom comme un ID — les noms peuvent être numériques).
   */
  function resolveItemVariationId(item: { variationId?: number | null; variation?: string | null; variationGroupIds?: Array<number | string> }): number | null {
    if (item.variationId != null) return Number(item.variationId)
    return variationStore.resolveVariationId(item.variationGroupIds, item.variation)
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

      const customerName = customerStore.client ? customerStore.clientName : 'Client'
      toast.info(`Vente en cours pour ${customerName} - Total: ${totalTTC.value.toFixed(2)} €`)

      const seller = sellersStore.sellers.find(s => s.id === Number(sellersStore.selectedSeller))

      const saleData = {
        items: cartStore.items.map((item) => {
          const finalPrice = cartStore.getFinalPrice(item)
          return {
            productId: item.id,
            productName: item.name,
            quantity: item.quantity,
            restockOnReturn: item.restockOnReturn ?? false,
            unitPrice: finalPrice,
            originalPrice: item.price,
            // Nom lisible (affichage/historique) ; l'ID est la clé de stock serveur
            variation: item.variation || null,
            variationId: resolveItemVariationId(item),
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
        // Les vouchers actifs sont ajoutés comme paiements de mode "Bon d'achat #CODE".
        // Le serveur valide leur statut/montant avant de les marquer 'used'.
        payments: [
          ...cartStore.appliedVouchers.map(v => ({
            mode: `Bon d'achat #${v.code}`,
            amount: v.amount,
          })),
          ...payments.value,
        ],
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
        // Idempotence : le serveur ignore un rejeu du même clientSaleId (double-submit)
        clientSaleId: cartStore.clientSaleId,
        loyaltyReward: cartStore.loyaltyReward
          ? {
              type: cartStore.loyaltyReward.type,
              value: cartStore.loyaltyReward.value,
              pointsToConsume: cartStore.loyaltyReward.pointsToConsume,
            }
          : null,
        usedVoucherIds: cartStore.appliedVouchers.map(v => v.id),
      }

      const response = await submitSaleWithRetry(saleData)

      if (!response.success) {
        throw new Error('Échec de l\'enregistrement de la vente')
      }

      // Surventes détectées par le serveur : la vente est validée mais le stock
      // de ces articles est passé en négatif — on liste précisément lesquels.
      if (response.stockWarnings?.length) {
        const details = response.stockWarnings
          .map(w => `${w.productName}${w.variation ? ` (${w.variation})` : ''} : stock restant ${w.remainingStock}`)
          .join(', ')
        toast.warning(`Survente — ${details}`)
      }

      // Capturer toutes les données AVANT le reset cart/customer
      lastSaleDocument.value = {
        ticketNumber: response.sale.ticketNumber,
        saleDate: response.sale.saleDate,
        hash: response.sale.hash,
        signature: response.sale.signature,
        establishment: {
          name: establishment.name,
          address: establishment.address,
          postalCode: establishment.postalCode,
          city: establishment.city,
          country: establishment.country,
          phone: establishment.phone,
          email: establishment.email,
          siret: establishment.siret,
          naf: establishment.naf,
          tvaNumber: establishment.tvaNumber,
        },
        registerName: register.name,
        sellerName: seller?.name || 'Vendeur inconnu',
        customer: customerStore.client
          ? {
              firstName: customerStore.client.firstName,
              lastName: customerStore.client.lastName,
              address: customerStore.client.address,
              postalCode: (customerStore.client.metadata as { postalCode?: string } | undefined)?.postalCode,
              city: customerStore.client.city,
              email: customerStore.client.email,
            }
          : null,
        items: cartStore.items.map(item => ({
          name: item.name,
          variation: item.variation || null,
          quantity: item.quantity,
          unitPrice: cartStore.getFinalPrice(item),
          originalPrice: item.price,
          discount: item.discount,
          discountType: item.discountType,
          tva: item.tva || 20,
        })),
        payments: payments.value.map(p => ({ mode: p.mode, amount: p.amount })),
        totals: {
          totalHT: totalHT.value,
          totalTVA: totalTVA.value,
          totalTTC: totalTTC.value,
        },
        changeDue: balance.value < 0 ? Math.abs(balance.value) : 0,
        loyalty: response.sale.loyalty
          ? {
              pointsEarned: response.sale.loyalty.pointsEarned,
              pointsConsumed: response.sale.loyalty.pointsConsumed,
              pointsTotalAfter: response.sale.loyalty.pointsTotalAfter,
              generatedVoucher: response.sale.loyalty.generatedVoucher,
            }
          : null,
      }

      productsStore.loaded = false
      await productsStore.loadProducts()

      toast.success('Vente enregistrée avec succès !')

      cartStore.clearCart()
      customerStore.clearClient()
      payments.value = []

      // Ouverture du dialog après reset (les données sont safe dans lastSaleDocument)
      showSuccessDialog.value = true
    }
    catch (error) {
      // Échec de soumission : dialog bloquant (pas de toast éphémère).
      // Aucun reset ici — panier, client et paiements restent intacts pour réessayer.
      console.error('Erreur lors de la validation:', error)
      errorDialogMessage.value = extractFetchError(error, 'Erreur lors de la validation de la vente')
      errorDialogTotal.value = totalTTC.value
      showErrorDialog.value = true
    }
    finally {
      isSubmitting.value = false
      retryAttempt.value = 0
    }
  }

  function retryFromErrorDialog() {
    showErrorDialog.value = false
    return validerVente()
  }

  function closeErrorDialog() {
    showErrorDialog.value = false
  }

  onMounted(() => {
    checkClosure()
    tryRestorePayments()
  })
  watch(selectedRegisterId, () => {
    checkClosure()
    tryRestorePayments()
  })

  return {
    payments,
    isSubmitting,
    isRetrying,
    isDayClosed,
    showErrorDialog,
    errorDialogMessage,
    errorDialogTotal,
    retryFromErrorDialog,
    closeErrorDialog,
    totalPaid,
    balance,
    totalTTC,
    totalHT,
    totalTVA,
    lastSaleDocument,
    showSuccessDialog,
    addPayment,
    removePayment,
    validerVente,
    checkClosure,
  }
}
