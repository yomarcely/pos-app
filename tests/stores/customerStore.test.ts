import { setActivePinia, createPinia } from 'pinia'
import { useCustomerStore } from '@/stores/customer'

describe('stores/customer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('charge les clients et marque loaded', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      success: true,
      clients: [{ id: 1, firstName: 'John', lastName: 'Doe' }]
    })
    vi.stubGlobal('$fetch', mockFetch)

    const store = useCustomerStore()
    await store.loadCustomers()

    expect(store.clients).toHaveLength(1)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('évite les appels multiples quand déjà chargé', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ success: true, clients: [] })
    vi.stubGlobal('$fetch', mockFetch)

    const store = useCustomerStore()
    await store.loadCustomers()
    await store.loadCustomers()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('gère les erreurs et renseigne error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('fail'))
    vi.stubGlobal('$fetch', mockFetch)

    const store = useCustomerStore()
    await store.loadCustomers()

    expect(store.error).toBe('fail')
    expect(store.loading).toBe(false)
  })

  it('sélectionne et réinitialise un client', () => {
    const store = useCustomerStore()
    const client = { id: 1, firstName: 'Jane', lastName: 'Doe' }

    store.selectClient(client as any)
    expect(store.client).toEqual(client)
    expect(store.clientName).toContain('Jane')
    expect(store.isSelected).toBe(true)

    store.clearClient()
    expect(store.client).toBeNull()
    expect(store.isSelected).toBe(false)
  })
})
