import { ref, type Ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'

export type MovementHistoryFilter =
  | 'all'
  | 'reception'
  | 'reception-supplier'
  | 'reception-free'
  | 'adjustment'
  | 'loss'
  | 'transfer'

export interface MovementHistoryItem {
  id: number
  productId: number
  productName: string
  variation: string | null
  quantity: number
  oldStock: number
  newStock: number
  reason: string
}

export interface MovementHistoryEntry {
  id: number
  movementNumber: string
  type: 'reception' | 'adjustment' | 'loss' | 'transfer'
  comment: string | null
  supplierId: number | null
  supplierName: string | null
  deliveryNoteNumber: string | null
  establishmentId: number | null
  establishmentName: string | null
  userId: number | null
  createdAt: string
  itemCount: number
  totalQuantity: number
  items: MovementHistoryItem[]
}

interface Period {
  startDate: string
  endDate: string
}

export function useMovementHistory(
  period: Ref<Period>,
  typeFilter: Ref<MovementHistoryFilter>,
  establishmentId: Ref<number | null>,
) {
  const toast = useToast()
  const movements = ref<MovementHistoryEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadHistory(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, string | number> = {
        dateFrom: period.value.startDate,
        dateTo: period.value.endDate,
      }
      if (typeFilter.value !== 'all') params.type = typeFilter.value
      if (establishmentId.value) params.establishmentId = establishmentId.value

      const response = await $fetch<{
        success: boolean
        movements: MovementHistoryEntry[]
        count: number
      }>('/api/movements/history', { params })

      movements.value = response.movements
    } catch (err) {
      error.value = extractFetchError(err, "Erreur lors du chargement de l'historique")
      toast.error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function deleteMovement(id: number): Promise<boolean> {
    try {
      await $fetch(`/api/movements/${id}`, { method: 'DELETE' })
      movements.value = movements.value.filter((m) => m.id !== id)
      toast.success('Mouvement supprimé et stock restauré')
      return true
    } catch (err) {
      toast.error(extractFetchError(err, 'Erreur lors de la suppression'))
      return false
    }
  }

  interface UpdatePayload {
    comment?: string | null
    supplierId?: number | null
    deliveryNoteNumber?: string | null
    lines?: Array<{ id: number; quantity: number }>
  }

  async function updateMovement(id: number, payload: UpdatePayload): Promise<boolean> {
    try {
      await $fetch(`/api/movements/${id}`, { method: 'PUT', body: payload })
      toast.success('Mouvement mis à jour')
      await loadHistory()
      return true
    } catch (err) {
      toast.error(extractFetchError(err, 'Erreur lors de la modification'))
      return false
    }
  }

  return {
    movements,
    loading,
    error,
    loadHistory,
    deleteMovement,
    updateMovement,
  }
}
