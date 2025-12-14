import { setActivePinia, createPinia } from 'pinia'
import { useSellersStore } from '@/stores/sellers'

describe('stores/sellers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('charge les vendeurs et définit loaded', async () => {
    const sellers = [{ id: 1, name: 'Alice' }]
    const fetchMock = vi.fn().mockResolvedValue({ sellers })
    vi.stubGlobal('$fetch', fetchMock)

    const store = useSellersStore()
    await store.loadSellers()

    expect(store.sellers).toEqual(sellers as any)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gère les erreurs lors du chargement', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('oops'))
    vi.stubGlobal('$fetch', fetchMock)

    const store = useSellersStore()
    await store.loadSellers()

    expect(store.error).toBe('oops')
    expect(store.loading).toBe(false)
  })

  it('sélectionne et réinitialise un vendeur', () => {
    const store = useSellersStore()
    store.sellers = [{ id: 1, name: 'Alice' } as any]

    store.selectSellerById(1)
    expect(store.selectedSeller).toBe('1')

    store.clearSeller()
    expect(store.selectedSeller).toBeNull()
  })
})
