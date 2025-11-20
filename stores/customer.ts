import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Customer } from '@/types'

export const useCustomerStore = defineStore('customer', () => {
  // État
  const client = ref<Customer | null>(null)
  const clients = ref<Customer[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions
  async function loadCustomers() {
    if (loaded.value || loading.value) return
    loading.value = true
    error.value = null

    try {
      const response = await $fetch('/api/customers')

      if (response.success) {
        clients.value = response.customers
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

  function selectClient(c: Customer) {
    client.value = c
  }

  function clearClient() {
    client.value = null
  }

  // Getters
  const clientName = computed(() =>
    client.value ? `${client.value.name} ${client.value.lastname}` : 'Aucun client'
  )

  const isSelected = computed(() => !!client.value)

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
