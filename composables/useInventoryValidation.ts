import { ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'

export interface PreparationSummary {
  id: number
  preparationNumber: string
  name: string | null
  comment: string | null
  establishmentId: number | null
  establishmentName: string | null
  status: 'draft' | 'validated'
  validatedAt: string | null
  validatedMovementId: number | null
  createdAt: string
  updatedAt: string
  itemCount: number
}

export interface InventoriedRow {
  productId: number
  productName: string
  variation: string | null
  currentStock: number
  countedStock: number
  delta: number
}

export interface NotInventoriedRow {
  productId: number
  productName: string
  variation: string | null
  stock: number
}

export interface PreviewResult {
  establishmentId: number | null
  preparations: Array<{ id: number; preparationNumber: string; name: string | null }>
  inventoried: InventoriedRow[]
  notInventoriedPositive: NotInventoriedRow[]
  notInventoriedNonPositive: NotInventoriedRow[]
}

export interface ConflictDetail {
  productId: number
  variation: string | null
  counts: Array<{ preparationNumber: string; countedStock: number }>
}

export function useInventoryValidation() {
  const toast = useToast()

  const preparations = ref<PreparationSummary[]>([])
  const loadingList = ref(false)

  const selectedIds = ref<Set<number>>(new Set())

  const preview = ref<PreviewResult | null>(null)
  const previewing = ref(false)
  const conflicts = ref<ConflictDetail[] | null>(null)

  async function loadPreparations(): Promise<void> {
    loadingList.value = true
    try {
      const response = await $fetch<{ success: boolean; preparations: PreparationSummary[]; count: number }>(
        '/api/inventory-preparations',
        { params: { limit: 200 } },
      )
      preparations.value = response.preparations
    } catch (error) {
      toast.error(extractFetchError(error, 'Erreur lors du chargement des préparations'))
    } finally {
      loadingList.value = false
    }
  }

  function toggleSelected(id: number) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function clearSelection() {
    selectedIds.value = new Set()
    preview.value = null
    conflicts.value = null
  }

  async function loadPreview(): Promise<boolean> {
    if (selectedIds.value.size === 0) {
      toast.error('Sélectionnez au moins une préparation')
      return false
    }
    previewing.value = true
    conflicts.value = null
    try {
      const result = await $fetch<{ success: boolean } & PreviewResult>(
        '/api/inventory-preparations/preview',
        {
          method: 'POST',
          body: { preparationIds: Array.from(selectedIds.value) },
        },
      )
      preview.value = {
        establishmentId: result.establishmentId,
        preparations: result.preparations,
        inventoried: result.inventoried,
        notInventoriedPositive: result.notInventoriedPositive,
        notInventoriedNonPositive: result.notInventoriedNonPositive,
      }
      return true
    } catch (error: unknown) {
      // Conflit 409 → on extrait le détail pour affichage
      const err = error as { statusCode?: number; data?: { conflicts?: ConflictDetail[] }; message?: string }
      if (err.statusCode === 409 && err.data?.conflicts) {
        conflicts.value = err.data.conflicts
        preview.value = null
        toast.error('Conflit de comptage entre préparations sélectionnées')
      } else {
        toast.error(extractFetchError(error, "Erreur lors du calcul de l'aperçu"))
      }
      return false
    } finally {
      previewing.value = false
    }
  }

  return {
    preparations,
    loadingList,
    selectedIds,
    preview,
    previewing,
    conflicts,
    loadPreparations,
    toggleSelected,
    clearSelection,
    loadPreview,
  }
}
