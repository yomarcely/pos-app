import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Customer } from '@/types'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

export const useCustomerStore = defineStore('customer', () => {
  // État
  const client = ref<Customer | null>(null)
  const clients = ref<Customer[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

  // Actions
  async function loadCustomers(): Promise<void> {
    if (loading.value) return
    loading.value = true
    error.value = null

    try {
      await initializeEstablishments()

      type ClientsResponse = { success: boolean; clients: Customer[] }
      const response = await $fetch<ClientsResponse>('/api/clients', {
        params: selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined,
      })

      if (response.success) {
        clients.value = response.clients
        loaded.value = true
      } else {
        throw new Error('Erreur lors de la récupération des clients')
      }
    } catch (err) {
      console.error('Erreur chargement clients', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  function selectClient(c: Customer): void {
    client.value = c
  }

  function clearClient(): void {
    client.value = null
  }

  // Getters
  const clientName = computed(() =>
    client.value ? `${client.value.firstName} ${client.value.lastName}` : 'Aucun client'
  )

  const isSelected = computed(() => !!client.value)

  // Recharger quand l'établissement change
  watch(selectedEstablishmentId, () => {
    loaded.value = false
    loadCustomers()
  })

  return {
    client,
    clients,
    loaded,
    loading,
    error,
    clientName,
    isSelected,
    loadCustomers,
    selectClient,
    clearClient
  }
})
