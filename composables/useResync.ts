import { reactive, ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'
import type { SyncGroup } from '@/composables/useSyncGroups'

export function useResync(loadSyncGroups: () => Promise<void>) {
  const toast = useToast()

  const resyncDialogOpen = ref(false)

  const resyncData = reactive({
    groupId: 0,
    groupName: '',
    entityType: 'product' as 'product' | 'customer',
    fields: [] as string[],
    sourceEstablishmentId: null as number | null,
    establishments: [] as any[],
  })

  // Labels pour les champs
  const fieldLabels: Record<string, string> = {
    // Produits
    price: 'Prix TTC',
    purchasePrice: 'Prix HT',
    name: 'Nom',
    description: 'Description',
    barcode: 'Code-barres',
    supplierId: 'Fournisseur',
    categoryId: 'Catégorie',
    brandId: 'Marque',
    tva: 'TVA',
    tvaId: 'TVA',
    image: 'Image',
    variationGroupIds: 'Variations',
    // Clients
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
    address: 'Adresse',
    metadata: 'Métadonnées',
    gdprConsent: 'Consentement RGPD',
    gdprConsentDate: 'Date consentement RGPD',
    marketingConsent: 'Consentement marketing',
    loyaltyProgram: 'Programme de fidélité',
    discount: 'Remise',
  }

  function showResyncDialog(group: SyncGroup, entityType: 'product' | 'customer', fields: string[]) {
    resyncData.groupId = group.id
    resyncData.groupName = group.name
    resyncData.entityType = entityType
    resyncData.fields = fields
    resyncData.sourceEstablishmentId = null
    resyncData.establishments = group.establishments || []
    resyncDialogOpen.value = true
  }

  async function performResync() {
    if (!resyncData.sourceEstablishmentId) {
      toast.error('Veuillez sélectionner un établissement source')
      return
    }

    try {
      const response: any = await $fetch(`/api/sync-groups/${resyncData.groupId}/resync`, {
        method: 'POST',
        body: {
          sourceEstablishmentId: resyncData.sourceEstablishmentId,
          entityType: resyncData.entityType,
          fields: resyncData.fields,
        },
      })

      toast.success(response.message || 'Resynchronisation effectuée avec succès')
      resyncDialogOpen.value = false
      await loadSyncGroups()
    } catch (error: unknown) {
      console.error('Erreur lors de la resynchronisation:', error)
      toast.error(extractFetchError(error, 'Erreur lors de la resynchronisation'))
    }
  }

  function skipResync() {
    resyncDialogOpen.value = false
    loadSyncGroups()
  }

  return {
    resyncDialogOpen,
    resyncData,
    fieldLabels,
    showResyncDialog,
    performResync,
    skipResync,
  }
}
