import { reactive, ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'
import type { SyncGroup, ProductRules, CustomerRules } from '@/composables/useSyncGroups'

type ProductRuleKey = keyof ProductRules
type CustomerRuleKey = keyof CustomerRules

export function useEditSyncGroup(
  loadSyncGroups: () => Promise<void>,
  showResyncDialog: (group: SyncGroup, entityType: 'product' | 'customer', fields: string[]) => void
) {
  const toast = useToast()

  const editGroupDialogOpen = ref(false)
  const selectedGroup = ref<SyncGroup | null>(null)

  const editGroup = reactive({
    id: 0,
    name: '',
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

  function openEditGroupDialog(group: SyncGroup) {
    selectedGroup.value = group
    editGroup.id = group.id
    editGroup.name = group.name
    editGroup.establishmentIds = group.establishments.map(e => e.id)
    Object.assign(
      editGroup.productRules,
      {
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
      group.productRules,
    )
    Object.assign(
      editGroup.customerRules,
      {
        syncCustomerInfo: true,
        syncCustomerContact: true,
        syncCustomerAddress: true,
        syncCustomerGdpr: true,
        syncLoyaltyProgram: false,
        syncDiscount: false,
      },
      group.customerRules,
    )
    editGroupDialogOpen.value = true
  }

  function toggleEditEstablishmentSelection(id: number, checked: boolean | 'indeterminate') {
    if (checked === 'indeterminate') {
      return
    }

    const index = editGroup.establishmentIds.indexOf(id)

    if (checked && index === -1) {
      editGroup.establishmentIds.push(id)
    } else if (!checked && index > -1) {
      editGroup.establishmentIds.splice(index, 1)
    }
  }

  async function updateGroupRules() {
    if (!selectedGroup.value) return

    if (editGroup.establishmentIds.length < 2) {
      toast.error('Le groupe doit contenir au moins 2 établissements')
      return
    }

    // Détecter les options qui viennent d'être réactivées (false -> true)
    const originalProductRules: Partial<ProductRules> = selectedGroup.value.productRules || {}
    const originalCustomerRules: Partial<CustomerRules> = selectedGroup.value.customerRules || {}

    const reactivatedProductFields: string[] = []
    const reactivatedCustomerFields: string[] = []

    // Vérifier les champs produits
    const productFieldsMap: Record<ProductRuleKey, string> = {
      syncPriceTtc: 'price',
      syncPriceHt: 'purchasePrice',
      syncName: 'name',
      syncDescription: 'description',
      syncBarcode: 'barcode',
      syncSupplier: 'supplierId',
      syncCategory: 'categoryId',
      syncBrand: 'brandId',
      syncTva: 'tva',
      syncImage: 'image',
      syncVariations: 'variationGroupIds',
    }

    for (const ruleKey of Object.keys(productFieldsMap) as ProductRuleKey[]) {
      const fieldName = productFieldsMap[ruleKey]
      if (!originalProductRules[ruleKey] && editGroup.productRules[ruleKey]) {
        reactivatedProductFields.push(fieldName)
      }
    }

    // Vérifier les champs clients
    const customerFieldsMap: Record<CustomerRuleKey, string> = {
      syncCustomerInfo: 'firstName,lastName',
      syncCustomerContact: 'email,phone',
      syncCustomerAddress: 'address,metadata',
      syncCustomerGdpr: 'gdprConsent,gdprConsentDate,marketingConsent',
      syncLoyaltyProgram: 'loyaltyProgram',
      syncDiscount: 'discount',
    }

    for (const ruleKey of Object.keys(customerFieldsMap) as CustomerRuleKey[]) {
      const fieldNames = customerFieldsMap[ruleKey]
      if (!originalCustomerRules[ruleKey] && editGroup.customerRules[ruleKey]) {
        // Plusieurs champs peuvent être associés à une règle (ex: syncCustomerInfo = firstName + lastName)
        reactivatedCustomerFields.push(...fieldNames.split(','))
      }
    }

    try {
      // Mettre à jour les établissements du groupe
      const originalEstablishmentIds = selectedGroup.value.establishments.map(e => e.id)
      if (JSON.stringify(originalEstablishmentIds.sort()) !== JSON.stringify(editGroup.establishmentIds.sort())) {
        await $fetch(`/api/sync-groups/${selectedGroup.value.id}/establishments`, {
          method: 'PATCH',
          body: {
            establishmentIds: editGroup.establishmentIds,
          },
        })
        toast.success('Établissements du groupe mis à jour')
      }

      // Mettre à jour les règles produits
      await $fetch(`/api/sync-groups/${selectedGroup.value.id}/rules`, {
        method: 'PATCH',
        body: {
          entityType: 'product',
          ...editGroup.productRules,
        },
      })

      // Mettre à jour les règles clients
      await $fetch(`/api/sync-groups/${selectedGroup.value.id}/rules`, {
        method: 'PATCH',
        body: {
          entityType: 'customer',
          ...editGroup.customerRules,
        },
      })

      toast.success('Configuration mise à jour avec succès')
      editGroupDialogOpen.value = false

      // Si des options ont été réactivées, proposer la resynchronisation
      if (reactivatedProductFields.length > 0) {
        showResyncDialog(selectedGroup.value, 'product', reactivatedProductFields)
      } else if (reactivatedCustomerFields.length > 0) {
        showResyncDialog(selectedGroup.value, 'customer', reactivatedCustomerFields)
      } else {
        await loadSyncGroups()
      }
    } catch (error: unknown) {
      console.error('Erreur lors de la mise à jour:', error)
      toast.error(extractFetchError(error, 'Impossible de mettre à jour la configuration'))
    }
  }

  return {
    editGroupDialogOpen,
    selectedGroup,
    editGroup,
    openEditGroupDialog,
    toggleEditEstablishmentSelection,
    updateGroupRules,
  }
}
