import { setActivePinia, createPinia } from 'pinia'
import { useTicketsStore } from '@/stores/tickets'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'

describe('stores/tickets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('ajoute un ticket et incrémente le compteur', () => {
    const store = useTicketsStore()
    const items = [{ id: 1, name: 'Produit', price: 10, tva: 20, quantity: 1, discount: 0, discountType: '%', variation: '' } as any]

    store.addTicket(items, 10)

    expect(store.ticketCount).toBe(1)
    expect(store.tickets[0].items).not.toBe(items)
    expect(store.tickets[0].items[0].name).toBe('Produit')
  })

  it('supprime un ticket', () => {
    const store = useTicketsStore()
    store.addTicket([], 0, 5)

    store.removeTicket(5)
    expect(store.ticketCount).toBe(0)
  })

  it('reprend un ticket dans le panier puis le supprime', () => {
    const tickets = useTicketsStore()
    const cart = useCartStore()
    const customer = useCustomerStore()
    customer.clients = [{ id: 1, name: 'Jane', lastname: 'Doe' } as any]

    const ticketItems = [{ id: 1, name: 'Prod', price: 5, tva: 20, quantity: 2, discount: 0, discountType: '%', variation: '' } as any]
    tickets.addTicket(ticketItems, 10, 7, 1)

    tickets.resumeTicket(7)

    expect(cart.items).toEqual(ticketItems)
    expect(tickets.ticketCount).toBe(0)
  })
})
