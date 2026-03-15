import { ref } from 'vue'

interface EstablishmentSelect {
  id: number
  name: string
  city?: string
}

export function useEstablishmentsSelect() {
  const availableEstablishments = ref<EstablishmentSelect[]>([])

  async function loadEstablishments() {
    try {
      const response = await $fetch<{ success: boolean; establishments: any[] }>('/api/establishments')
      availableEstablishments.value = response.establishments
        .filter((e: any) => e.isActive)
        .map((e: any) => ({ id: e.id, name: e.name, city: e.city }))
    } catch (error) {
      console.error('Erreur lors du chargement des établissements:', error)
    }
  }

  return { availableEstablishments, loadEstablishments }
}
