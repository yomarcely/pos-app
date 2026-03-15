import { ref, type Ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'

interface StockHistoryItem {
  id: number
  productId: number | null
  variation: string | null
  quantity: number
  previousStock: number | null
  newStock: number | null
  reason: string | null
  createdAt: string | null
  saleId: number | null
  movementId: number | null
  movementNumber: string | null
  movementComment: string | null
  receiptNumber: null
  saleTicket: string | null
}

export function useProductStockMovement(
  productId: Ref<number>,
  form: Ref<{ hasVariations: boolean }>,
  selectedVariationsList: Ref<any[]>,
  originalProduct: Ref<any>,
  loadProduct: () => Promise<void>
) {
  const toast = useToast()

  const stockDialogOpen = ref(false)
  const movementType = ref<'reception' | 'adjustment'>('reception')
  const movementQuantities = ref<Record<string | number, number | null>>({})
  const historyDialogOpen = ref(false)
  const loadingHistory = ref(false)
  const stockHistory = ref<any[]>([])
  const savingMovement = ref(false)

  function getStockByVariation(variationId: number): number {
    if (!originalProduct.value?.stockByVariation) return 0
    return originalProduct.value.stockByVariation[variationId] || 0
  }

  function resetMovementQuantities() {
    if (form.value.hasVariations) {
      const quantities: Record<string | number, number | null> = {}
      for (const variation of selectedVariationsList.value) {
        quantities[variation.id] = null
      }
      movementQuantities.value = quantities
    } else {
      movementQuantities.value = { base: null }
    }
  }

  function openStockDialog(type: 'reception' | 'adjustment') {
    movementType.value = type
    resetMovementQuantities()
    stockDialogOpen.value = true
  }

  function setMovementQuantity(key: string | number, value: string | number) {
    const parsed = Number(value)
    movementQuantities.value = {
      ...movementQuantities.value,
      [key]: Number.isFinite(parsed) ? parsed : null,
    }
  }

  async function submitStockMovement() {
    const items: any[] = []
    const adjustmentType = movementType.value === 'reception' ? 'add' : 'set'

    if (form.value.hasVariations) {
      for (const variation of selectedVariationsList.value) {
        const qty = movementQuantities.value[variation.id]
        if (qty === null || qty === undefined || !Number.isFinite(qty)) continue
        items.push({
          productId: productId.value,
          variation: variation.id.toString(),
          quantity: Number(qty),
          adjustmentType,
        })
      }
    } else {
      const qty = movementQuantities.value['base']
      if (qty !== null && qty !== undefined && Number.isFinite(qty)) {
        items.push({
          productId: productId.value,
          quantity: Number(qty),
          adjustmentType,
        })
      }
    }

    if (!items.length) {
      toast.error('Renseignez au moins une quantité')
      return
    }

    savingMovement.value = true
    try {
      await $fetch('/api/movements/create', {
        method: 'POST',
        body: {
          type: movementType.value,
          items,
        },
      })
      toast.success('Mouvement enregistré')
      stockDialogOpen.value = false
      await loadProduct()
    } catch (error: unknown) {
      console.error('Erreur lors du mouvement de stock:', error)
      toast.error(extractFetchError(error, 'Erreur lors du mouvement de stock'))
    } finally {
      savingMovement.value = false
    }
  }

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleString('fr-FR')
  }

  function reasonLabel(reason: string) {
    const map: Record<string, string> = {
      reception: 'Entrée',
      inventory_adjustment: 'Ajustement',
      loss: 'Perte',
      transfer: 'Transfert',
    }
    return map[reason] || reason
  }

  async function openHistory() {
    historyDialogOpen.value = true
    if (stockHistory.value.length) return
    await loadHistory()
  }

  async function loadHistory() {
    try {
      loadingHistory.value = true
      const response = await $fetch<{ success: boolean; movements: StockHistoryItem[]; count: number }>(`/api/products/${productId.value}/stock-history`)
      stockHistory.value = response.movements || []
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error)
      toast.error('Erreur lors du chargement de l\'historique')
    } finally {
      loadingHistory.value = false
    }
  }

  return {
    stockDialogOpen,
    movementType,
    movementQuantities,
    historyDialogOpen,
    loadingHistory,
    stockHistory,
    savingMovement,
    getStockByVariation,
    resetMovementQuantities,
    openStockDialog,
    setMovementQuantity,
    submitStockMovement,
    formatDate,
    reasonLabel,
    openHistory,
    loadHistory,
  }
}
