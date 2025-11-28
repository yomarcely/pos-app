import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MovementsPage from '@/pages/mouvements/index.vue'
import { ref as vueRef, onMounted as vueOnMounted, watch as vueWatch } from 'vue'
import { nextTick } from 'vue'

const toastMock = {
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock
}))

const product = {
  id: 1,
  name: 'Prod',
  stock: 5,
  variationGroupIds: [],
  stockByVariation: {},
  price: 10,
  tva: 20
}

const fetchMock = vi.fn()

describe('Page mouvements', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('ref', vueRef)
    vi.stubGlobal('onMounted', vueOnMounted)
    vi.stubGlobal('watch', vueWatch)
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/products')) {
        return Promise.resolve({ products: [product], categories: [], suppliers: [], brands: [] })
      }
      if (url.includes('/api/categories')) return Promise.resolve({ categories: [] })
      if (url.includes('/api/suppliers')) return Promise.resolve({ suppliers: [] })
      if (url.includes('/api/brands')) return Promise.resolve({ brands: [] })
      if (url.includes('/api/variations')) return Promise.resolve({ groups: [] })
      return Promise.resolve({ products: [product] })
    })
    toastMock.error.mockClear()
    toastMock.success.mockClear()
    toastMock.info.mockClear()
    toastMock.warning.mockClear()
  })

  it('charge le catalogue et permet d’ajouter un produit via suggestions', async () => {
    const wrapper = mount(MovementsPage, {
      global: {
        stubs: {
          Card: { template: '<div><slot /></div>' },
          CardHeader: { template: '<div><slot /></div>' },
          CardContent: { template: '<div><slot /></div>' },
          CardTitle: { template: '<div><slot /></div>' },
          ProductSearchWithSuggestions: { template: '<div class="search"></div>' },
          MovementTypeSelector: { template: '<div></div>' },
          SelectedProductsTable: { template: '<div class="selected-table"></div>' },
          ProductCatalogDialog: { template: '<div></div>' }
        }
      }
    })

    const vm: any = wrapper.vm
    await vm.addProductFromCatalog(product)
    await nextTick()
    expect(toastMock.success).toHaveBeenCalled()
  })
})
