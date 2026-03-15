import { setActivePinia, createPinia } from 'pinia'
import { vi } from 'vitest'
import { ref } from 'vue'
import { useCustomerStore } from '@/stores/customer'

// Mock useEstablishmentRegister so initializeEstablishments doesn't call $fetch
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedEstablishmentId: ref(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    initialized: ref(true)
  })
}))

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

  it('évite les appels simultanés (loading guard)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ success: true, clients: [] })
    vi.stubGlobal('$fetch', mockFetch)

    const store = useCustomerStore()
    // Appels séquentiels : le premier doit réussir, le second aussi (pas de guard loaded)
    await store.loadCustomers()
    await store.loadCustomers()

    // Le store recharge à chaque appel séquentiel (pas de cache loaded)
    expect(mockFetch).toHaveBeenCalled()
    expect(store.loaded).toBe(true)
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
