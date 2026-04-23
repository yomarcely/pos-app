import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useSellersStore } from '@/stores/sellers'

const mockAuth = { tenantId: null as string | null }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth,
}))

describe('stores/sellers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockAuth.tenantId = null
    // process.client est injecté par Nuxt — absent en vitest, donc on le force.
    ;(process as unknown as { client: boolean }).client = true
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (process as unknown as { client?: boolean }).client
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

describe('stores/sellers — Q5 localStorage scoping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockAuth.tenantId = null
    ;(process as unknown as { client: boolean }).client = true
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (process as unknown as { client?: boolean }).client
  })

  it('hydrate depuis la clé scopée du tenant courant uniquement', async () => {
    localStorage.setItem('pos_selected_seller_tenant-a', '42')
    localStorage.setItem('pos_selected_seller_tenant-b', '99')
    mockAuth.tenantId = 'tenant-a'

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      sellers: [{ id: 42, name: 'Alice' }],
    }))

    const store = useSellersStore()
    await store.initialize()

    expect(store.selectedSeller).toBe('42')
  })

  it('sauvegarde sous la clé scopée au tenantId', async () => {
    mockAuth.tenantId = 'tenant-a'

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      sellers: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
    }))

    const store = useSellersStore()
    await store.initialize()

    store.selectSellerById(2)
    await nextTick()

    expect(localStorage.getItem('pos_selected_seller_tenant-a')).toBe('2')
    expect(localStorage.getItem('pos_selected_seller')).toBeNull()
  })

  it('nettoie l\'ancienne clé non-scopée au premier init', async () => {
    localStorage.setItem('pos_selected_seller', '99')
    mockAuth.tenantId = 'tenant-a'

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ sellers: [] }))

    await useSellersStore().initialize()

    expect(localStorage.getItem('pos_selected_seller')).toBeNull()
  })

  it('ne sauve rien si tenantId absent (fail-closed)', async () => {
    mockAuth.tenantId = null

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      sellers: [{ id: 1, name: 'Alice' }],
    }))

    const store = useSellersStore()
    await store.initialize()

    store.selectSellerById(1)
    await nextTick()

    expect(localStorage.length).toBe(0)
  })

  it('User B sur tenant-b ne voit pas la sélection seller de User A sur tenant-a', async () => {
    // User A sur tenant-a sélectionne seller 5
    mockAuth.tenantId = 'tenant-a'
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      sellers: [{ id: 5, name: 'Alice' }],
    }))
    const storeA = useSellersStore()
    await storeA.initialize()
    storeA.selectSellerById(5)
    await nextTick()

    expect(localStorage.getItem('pos_selected_seller_tenant-a')).toBe('5')

    // User B se connecte sur tenant-b dans le même navigateur
    setActivePinia(createPinia()) // simule un nouveau cycle de session
    mockAuth.tenantId = 'tenant-b'
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      sellers: [{ id: 7, name: 'Bob' }],
    }))
    const storeB = useSellersStore()
    await storeB.initialize()

    // User B ne doit pas hériter de la sélection 5 de User A
    expect(storeB.selectedSeller).not.toBe('5')
    expect(storeB.selectedSeller).toBe('7') // ensureValidSelectedSeller retombe sur le 1er
  })
})
