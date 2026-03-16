import { ref, watch, type Ref } from 'vue'
import { useToast } from '@/composables/useToast'

export function useClientPurchaseHistory(clientId: Ref<number>) {
  const toast = useToast()
  const purchases = ref<any[]>([])
  const loadingPurchases = ref(false)
  const showPurchaseHistory = ref(false)

  async function loadPurchaseHistory() {
    try {
      loadingPurchases.value = true
      const response = await $fetch<{ purchases: any[] }>(`/api/clients/${clientId.value}/purchases`)
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
