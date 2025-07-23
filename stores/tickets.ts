import { defineStore } from 'pinia'
import type { Ticket, ProductInCart } from '@/types'
import { useCartStore } from './cart'
import { useCustomerStore } from './customer'

export const useTicketsStore = defineStore('tickets', {
  state: () => ({
    tickets: [] as Ticket[],
    nextId: 1
  }),

  getters: {
    ticketCount: state => state.tickets.length
  },

  actions: {
    addTicket(
      items: ProductInCart[],
      totalTTC: number,
      id: number | null = null,
      clientId: number | null = null
    ) {
      const ticket: Ticket = {
        id: id ?? this.nextId++,
        items: JSON.parse(JSON.stringify(items)),
        totalTTC,
        clientId,
        date: new Date()
      }
      this.tickets.push(ticket)
    },

    removeTicket(id: number) {
      this.tickets = this.tickets.filter(t => t.id !== id)
    },

    resumeTicket(id: number) {
      const ticket = this.tickets.find(t => t.id === id)
      if (!ticket) return

      const cart = useCartStore()
      const customer = useCustomerStore()

      cart.items = JSON.parse(JSON.stringify(ticket.items))
      if (ticket.clientId) {
        // Tu pourrais ici appeler une méthode pour rechercher le client
        // et faire : customer.selectClient(clientTrouvé)
      }

      this.removeTicket(id)
    }
  }
})
