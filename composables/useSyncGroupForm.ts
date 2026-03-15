import { reactive, ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'

export function useSyncGroupForm(loadSyncGroups: () => Promise<void>) {
  const toast = useToast()

  const createGroupDialogOpen = ref(false)

  const newGroup = reactive({
    name: '',
    description: '',
    establishmentIds: [] as number[],
    productRules: {
      syncName: true,
      syncDescription: true,
      syncBarcode: true,
      syncCategory: true,
      syncSupplier: true,
      syncBrand: true,
      syncPriceHt: true,
      syncPriceTtc: false,
      syncTva: true,
      syncImage: true,
      syncVariations: true,
    },
    customerRules: {
      syncCustomerInfo: true,
      syncCustomerContact: true,
      syncCustomerAddress: true,
      syncCustomerGdpr: true,
      syncLoyaltyProgram: false,
      syncDiscount: false,
    },
  })

  function openCreateGroupDialog() {
    newGroup.name = ''
    newGroup.description = ''
    newGroup.establishmentIds = []
    newGroup.productRules.syncName = true
    newGroup.productRules.syncDescription = true
    newGroup.productRules.syncBarcode = true
    newGroup.productRules.syncCategory = true
    newGroup.productRules.syncSupplier = true
    newGroup.productRules.syncBrand = true
    newGroup.productRules.syncPriceHt = true
    newGroup.productRules.syncPriceTtc = false
    newGroup.productRules.syncTva = true
    newGroup.productRules.syncImage = true
    newGroup.productRules.syncVariations = true
    newGroup.customerRules.syncCustomerInfo = true
    newGroup.customerRules.syncCustomerContact = true
    newGroup.customerRules.syncCustomerAddress = true
    newGroup.customerRules.syncCustomerGdpr = true
    newGroup.customerRules.syncLoyaltyProgram = false
    newGroup.customerRules.syncDiscount = false

    createGroupDialogOpen.value = true
  }

  function toggleEstablishmentSelection(id: number, checked: boolean | 'indeterminate') {
    console.log('toggleEstablishmentSelection appelé avec:', { id, checked })

    if (checked === 'indeterminate') {
      return
    }

    const index = newGroup.establishmentIds.indexOf(id)

    if (checked && index === -1) {
      newGroup.establishmentIds.push(id)
    } else if (!checked && index > -1) {
      newGroup.establishmentIds.splice(index, 1)
    }

    console.log('Établissements sélectionnés:', newGroup.establishmentIds)
  }

  async function createGroup() {
    console.log('Création du groupe avec:', newGroup)

    if (!newGroup.name.trim()) {
      toast.error('Le nom du groupe est obligatoire')
      return
    }

    if (newGroup.establishmentIds.length < 2) {
      console.log('Nombre d\'établissements:', newGroup.establishmentIds.length)
      toast.error('Sélectionnez au moins 2 établissements')
      return
    }

    try {
      await $fetch('/api/sync-groups/create', {
        method: 'POST',
        body: newGroup,
      })

      toast.success('Groupe de synchronisation créé avec succès')
      createGroupDialogOpen.value = false
      await loadSyncGroups()
    } catch (error: unknown) {
      console.error('Erreur lors de la création du groupe:', error)
      toast.error(extractFetchError(error, 'Impossible de créer le groupe'))
    }
  }

  return {
    createGroupDialogOpen,
    newGroup,
    openCreateGroupDialog,
    toggleEstablishmentSelection,
    createGroup,
  }
}
