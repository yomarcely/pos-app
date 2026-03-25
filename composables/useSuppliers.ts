import { ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import type { Supplier } from '@/types'

interface SupplierData {
  name: string
  email?: string | null
  phone?: string | null
  contact?: string | null
  address?: string | null
}

export function useSuppliers() {
  const suppliers = ref<Supplier[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadSuppliers(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      suppliers.value = await $fetch<Supplier[]>('/api/suppliers')
    } catch (err) {
      error.value = extractFetchError(err, 'Erreur lors du chargement des fournisseurs')
    } finally {
      loading.value = false
    }
  }

  async function createSupplier(data: SupplierData): Promise<void> {
    await $fetch('/api/suppliers/create', {
      method: 'POST',
      body: data,
    })
    await loadSuppliers()
  }

  async function updateSupplier(id: number, data: Partial<SupplierData>): Promise<void> {
    await $fetch(`/api/suppliers/${id}/update`, {
      method: 'PATCH',
      body: data,
    })
    await loadSuppliers()
  }

  async function deleteSupplier(id: number): Promise<void> {
    await $fetch(`/api/suppliers/${id}/delete`, {
      method: 'DELETE',
    })
    await loadSuppliers()
  }

  return {
    suppliers,
    loading,
    error,
    loadSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  }
}
