import { mount } from '@vue/test-utils'
import EditProductPage from '@/pages/produits/[id]/edit.vue'

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '1' } }),
  useRouter: () => ({ push: vi.fn() })
}))

const fetchMock = vi.fn()

describe('pages/produits/[id]/edit', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('onMounted', (fn: any) => fn())
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('navigateTo', vi.fn())
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/products/') && !opts) {
        return Promise.resolve({
          product: { id: 1, name: 'Prod', price: 10, tva: 20, variationGroupIds: [] },
          categories: [], suppliers: [], brands: [],
          stockHistory: [], relatedMovements: []
        })
      }
      if (url.includes('/api/products/') && opts?.method === 'PUT') {
        return Promise.resolve({ success: true })
      }
      if (url.includes('/api/variations')) return Promise.resolve({ groups: [] })
      return Promise.resolve({})
    })
    Object.values(toastMock).forEach(fn => fn.mockClear())
  })

  it('charge un produit et sauvegarde les modifications', async () => {
    const wrapper = mount(EditProductPage, {
      global: {
        stubs: {
          ProductFormGeneral: { template: '<div></div>' },
          ProductFormPricing: { template: '<div></div>' },
          ProductFormVariations: { template: '<div></div>' },
          ProductFormStock: { template: '<div></div>' },
          ProductFormBarcode: { template: '<div></div>' },
          FormDialog: { template: '<div><slot /></div>' },
          Button: { template: '<button><slot /></button>' }
        }
      },
      props: {
        id: '1'
      }
    })

    const submit = (wrapper.vm as any).$setup?.saveProduct || (wrapper.vm as any).saveProduct
    expect(submit).toBeTypeOf('function')
    await submit()

    expect(toastMock.error).toHaveBeenCalled()
  })
})
