import { defineStore } from 'pinia'
import type { ClientBase } from '@/types'

export const useCustomerStore = defineStore('customer', {
  state: () => ({
    client: null as ClientBase | null
  }),

  getters: {
    clientName: state =>
      state.client ? `${state.client.name} ${state.client.lastname}` : 'Aucun client',

    isSelected: state => !!state.client
  },

  actions: {
    selectClient(client: ClientBase) {
      this.client = client
    },

    clearClient() {
      this.client = null
    }
  }
})
