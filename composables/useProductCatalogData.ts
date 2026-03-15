import { ref, type Ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'
import type { Supplier, Brand, VariationGroup } from '@/types'

type CategoryNode = { id: number; name: string; children?: CategoryNode[] }

export function useProductCatalogData(
  selectedEstablishmentId: Ref<number | null>,
  form: Ref<{ supplierId: string | null; brandId: string | null }>
) {
  const toast = useToast()

  const suppliers = ref<any[]>([])
  const brands = ref<any[]>([])
  const categories = ref<any[]>([])
  const variationGroups = ref<any[]>([])

  const showAddCategoryDialog = ref(false)
  const showAddSupplierDialog = ref(false)
  const showAddBrandDialog = ref(false)
  const newCategoryName = ref('')
  const newSupplierName = ref('')
  const newBrandName = ref('')

  async function loadSuppliers() {
    try {
      const params = selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : {}
      const response = await $fetch<Supplier[]>('/api/suppliers', { params })
      suppliers.value = response
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error)
    }
  }

  async function loadBrands() {
    try {
      const params = selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : {}
      const response = await $fetch<Brand[]>('/api/brands', { params })
      brands.value = response
    } catch (error) {
      console.error('Erreur lors du chargement des marques:', error)
    }
  }

  async function loadCategories() {
    try {
      const response = await $fetch<{ success: boolean; categories: CategoryNode[]; totalCount: number }>('/api/categories', {
        params: selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined,
      })
      categories.value = response.categories || []
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error)
    }
  }

  async function loadVariationGroups() {
    try {
      const response = await $fetch<{ success: boolean; groups: VariationGroup[] }>('/api/variations/groups', {
        params: selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined,
      })
      variationGroups.value = response.groups || []
    } catch (error) {
      console.error('Erreur lors du chargement des variations:', error)
    }
  }

  function openAddSupplierDialog() {
    newSupplierName.value = ''
    showAddSupplierDialog.value = true
  }

  function openAddBrandDialog() {
    newBrandName.value = ''
    showAddBrandDialog.value = true
  }

  async function saveNewCategory(categoryName?: string) {
    const name = categoryName ?? newCategoryName.value
    if (!name.trim()) return
    try {
      const params = selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined
      const response = await $fetch<{ success: boolean; category: { id: number; name: string } }>('/api/categories/create', {
        method: 'POST',
        body: { name, parentId: null },
        params,
      })
      if (response?.success) {
        toast.success('Catégorie créée avec succès')
        await loadCategories()
        showAddCategoryDialog.value = false
      }
    } catch (error: unknown) {
      toast.error(extractFetchError(error, 'Erreur lors de la création'))
    }
  }

  async function saveNewSupplier(supplierName?: string) {
    const name = supplierName ?? newSupplierName.value
    if (!name.trim()) return
    try {
      const response = await $fetch<Supplier>('/api/suppliers/create', {
        method: 'POST',
        body: { name }
      })
      const created = response
      if (created?.id) {
        toast.success('Fournisseur créé avec succès')
        await loadSuppliers()
        form.value.supplierId = created.id.toString()
        showAddSupplierDialog.value = false
      }
    } catch (error: unknown) {
      toast.error(extractFetchError(error, 'Erreur lors de la création'))
    }
  }

  async function saveNewBrand(brandName?: string) {
    const name = brandName ?? newBrandName.value
    if (!name.trim()) return
    try {
      const response = await $fetch<Brand>('/api/brands/create', {
        method: 'POST',
        body: { name }
      })
      const created = response
      if (created?.id) {
        toast.success('Marque créée avec succès')
        await loadBrands()
        form.value.brandId = created.id.toString()
        showAddBrandDialog.value = false
      }
    } catch (error: unknown) {
      toast.error(extractFetchError(error, 'Erreur lors de la création'))
    }
  }

  return {
    suppliers,
    brands,
    categories,
    variationGroups,
    showAddCategoryDialog,
    showAddSupplierDialog,
    showAddBrandDialog,
    newCategoryName,
    newSupplierName,
    newBrandName,
    loadSuppliers,
    loadBrands,
    loadCategories,
    loadVariationGroups,
    openAddSupplierDialog,
    openAddBrandDialog,
    saveNewCategory,
    saveNewSupplier,
    saveNewBrand,
  }
}
