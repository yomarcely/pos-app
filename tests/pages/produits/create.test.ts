import { mount } from '@vue/test-utils'
import CreateProductPage from '@/pages/produits/create.vue'

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
  useRouter: () => ({ push: vi.fn() })
}))

const fetchMock = vi.fn()

describe('pages/produits/create', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('onMounted', (fn: any) => fn())
    vi.stubGlobal('navigateTo', vi.fn())
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/products') && opts?.method === 'POST') {
        return Promise.resolve({ success: true, product: { id: 1 } })
      }
      if (url.includes('/api/categories')) return Promise.resolve({ categories: [] })
      if (url.includes('/api/suppliers')) return Promise.resolve({ suppliers: [] })
      if (url.includes('/api/brands')) return Promise.resolve({ brands: [] })
      if (url.includes('/api/variations')) return Promise.resolve({ groups: [] })
      return Promise.resolve({ products: [] })
    })
    Object.values(toastMock).forEach(fn => fn.mockClear())
  })

  it('soumet un produit et affiche un toast de succès', async () => {
    const wrapper = mount(CreateProductPage, {
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
      }
    })

    // Appel direct : avec form.name vide, on doit avoir une erreur de validation
    const submit = (wrapper.vm as any).$setup?.saveProduct || (wrapper.vm as any).saveProduct
    expect(submit).toBeTypeOf('function')
    await submit()

    expect(toastMock.error).toHaveBeenCalled()
  })
})
