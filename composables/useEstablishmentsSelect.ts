import { ref } from 'vue'

interface EstablishmentSelect {
  id: number
  name: string
  city?: string
}

interface RawEstablishmentSelect {
  id: number
  name: string
  city?: string
  isActive?: boolean | null
}

export function useEstablishmentsSelect() {
  const availableEstablishments = ref<EstablishmentSelect[]>([])

  async function loadEstablishments() {
    try {
      const response = await $fetch<{ success: boolean; establishments: RawEstablishmentSelect[] }>('/api/establishments')
      availableEstablishments.value = response.establishments
        .filter((e) => e.isActive)
        .map((e) => ({ id: e.id, name: e.name, city: e.city }))
    } catch (error) {
      console.error('Erreur lors du chargement des établissements:', error)
    }
  }

  return { availableEstablishments, loadEstablishments }
}
