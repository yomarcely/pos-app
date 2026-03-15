import { ref } from 'vue'
import { useToast } from '@/composables/useToast'

export interface SyncGroupEstablishment {
  id: number
  name: string
  city?: string
}

export type ProductRules = {
  syncName: boolean
  syncDescription: boolean
  syncBarcode: boolean
  syncCategory: boolean
  syncSupplier: boolean
  syncBrand: boolean
  syncPriceHt: boolean
  syncPriceTtc: boolean
  syncTva: boolean
  syncImage: boolean
  syncVariations: boolean
}

export type CustomerRules = {
  syncCustomerInfo: boolean
  syncCustomerContact: boolean
  syncCustomerAddress: boolean
  syncCustomerGdpr: boolean
  syncLoyaltyProgram: boolean
  syncDiscount: boolean
}

export interface SyncGroup {
  id: number
  name: string
  description?: string
  establishmentCount: number
  establishments: SyncGroupEstablishment[]
  productRules?: Partial<ProductRules>
  customerRules?: Partial<CustomerRules>
}

export function useSyncGroups() {
  const toast = useToast()

  const loading = ref(true)
  const syncGroups = ref<SyncGroup[]>([])
  const selectedGroup = ref<SyncGroup | null>(null)
  const deleteGroupDialogOpen = ref(false)

  async function loadSyncGroups() {
    try {
      loading.value = true
      const response = await $fetch<{ success: boolean; syncGroups: SyncGroup[] }>('/api/sync-groups')
      syncGroups.value = response.syncGroups
    } catch (error) {
      console.error('Erreur lors du chargement des groupes:', error)
      toast.error('Erreur lors du chargement des groupes de synchronisation')
    } finally {
      loading.value = false
    }
  }

  function openDeleteGroupDialog(group: SyncGroup) {
    selectedGroup.value = group
    deleteGroupDialogOpen.value = true
  }

  async function deleteGroup() {
    if (!selectedGroup.value) return

    try {
      await $fetch(`/api/sync-groups/${selectedGroup.value.id}/delete`, {
        method: 'DELETE',
      })

      toast.success('Groupe supprimé avec succès')
      deleteGroupDialogOpen.value = false
      await loadSyncGroups()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      toast.error('Impossible de supprimer le groupe')
    }
  }

  return {
    loading,
    syncGroups,
    selectedGroup,
    deleteGroupDialogOpen,
    loadSyncGroups,
    openDeleteGroupDialog,
    deleteGroup,
  }
}
