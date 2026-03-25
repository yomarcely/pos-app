import { ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import type { Brand } from '@/types'

export function useBrands() {
  const brands = ref<Brand[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadBrands(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      brands.value = await $fetch<Brand[]>('/api/brands')
    } catch (err) {
      error.value = extractFetchError(err, 'Erreur lors du chargement des marques')
    } finally {
      loading.value = false
    }
  }

  async function createBrand(name: string): Promise<void> {
    await $fetch('/api/brands/create', {
      method: 'POST',
      body: { name },
    })
    await loadBrands()
  }

  async function updateBrand(id: number, name: string): Promise<void> {
    await $fetch(`/api/brands/${id}/update`, {
      method: 'PATCH',
      body: { name },
    })
    await loadBrands()
  }

  async function deleteBrand(id: number): Promise<void> {
    await $fetch(`/api/brands/${id}/delete`, {
      method: 'DELETE',
    })
    await loadBrands()
  }

  return {
    brands,
    loading,
    error,
    loadBrands,
    createBrand,
    updateBrand,
    deleteBrand,
  }
}
