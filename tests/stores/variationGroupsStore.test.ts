import { setActivePinia, createPinia } from 'pinia'
import { useVariationGroupsStore } from '@/stores/variationGroups'

describe('stores/variationGroups', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('charge les groupes de variations une seule fois', async () => {
    const groups = [{ id: 1, name: 'Taille', variations: [] }]
    const fetchMock = vi.fn().mockResolvedValue({ groups })
    vi.stubGlobal('$fetch', fetchMock)

    const store = useVariationGroupsStore()
    await store.loadGroups()
    await store.loadGroups() // ne doit pas rappeler $fetch

    expect(store.groups).toEqual(groups)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
