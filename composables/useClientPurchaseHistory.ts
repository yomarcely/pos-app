import { ref, watch, type Ref } from 'vue'
import { useToast } from '@/composables/useToast'

export interface PurchaseHistoryItem {
  id: number
  productName: string
  variation: string | null
  quantity: number
  unitPrice: string
  totalTTC: string
  discount: string | null
  discountType: string | null
}

export interface PurchaseHistoryEntry {
  id: number
  ticketNumber: string
  status: string
  saleDate: string
  totalTTC: string
  items?: PurchaseHistoryItem[]
}

export function useClientPurchaseHistory(clientId: Ref<number>) {
  const toast = useToast()
  const purchases = ref<PurchaseHistoryEntry[]>([])
  const loadingPurchases = ref(false)
  const showPurchaseHistory = ref(false)

  async function loadPurchaseHistory() {
    try {
      loadingPurchases.value = true
      const response = await $fetch<{ purchases: PurchaseHistoryEntry[] }>(`/api/clients/${clientId.value}/purchases`)
      purchases.value = response.purchases || []
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique:", error)
      toast.error("Impossible de charger l'historique des achats")
    } finally {
      loadingPurchases.value = false
    }
  }

  watch(showPurchaseHistory, (isOpen) => {
    if (isOpen && purchases.value.length === 0) {
      loadPurchaseHistory()
    }
  })

  return { purchases, loadingPurchases, showPurchaseHistory }
}
