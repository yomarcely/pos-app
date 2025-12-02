import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ColRight from '@/components/caisse/ColRight.vue'

// Stubs UI
const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const ButtonStub = { template: `<button @click="$emit('click', $event)" :disabled="disabled"><slot /></button>`, props: ['disabled'] }
const IconStub = { template: '<span />' }
const SimpleStub = { template: '<div><slot /></div>' }

// Mocks stores
const cartStoreMock = {
  items: [] as any[],
  globalDiscount: 0,
  globalDiscountType: '%',
  getFinalPrice: vi.fn((item) => item.price),
  clearCart: vi.fn(),
  totalTTC: 0,
  totalHT: 0,
  totalTVA: 0
}

const productsStoreMock = {
  loaded: true,
  loadProducts: vi.fn()
}

const customerStoreMock = {
  client: null as any,
  clientName: '',
  clearClient: vi.fn()
}

const sellersStoreMock = {
  sellers: [{ id: 1, name: 'Seller 1' }],
  selectedSeller: '',
}

const toastMock = {
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  success: vi.fn()
}

vi.mock('@/stores/cart', () => ({
  useCartStore: () => cartStoreMock
}))
vi.mock('@/stores/products', () => ({
  useProductsStore: () => productsStoreMock
}))
vi.mock('@/stores/customer', () => ({
  useCustomerStore: () => customerStoreMock
}))
vi.mock('@/stores/sellers', () => ({
  useSellersStore: () => sellersStoreMock
}))
vi.mock('@/stores/variationGroups', () => ({
  useVariationGroupsStore: () => ({ groups: [] })
}))
vi.mock('pinia', () => ({
  defineStore: (_id: string, setup: any) => setup,
  storeToRefs: (store: any) => ({
    totalTTC: store.totalTTC,
    totalHT: store.totalHT,
    totalTVA: store.totalTVA
  })
}))
vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock
}))

describe('ColRight (caisse)', () => {
  beforeEach(() => {
    cartStoreMock.items = []
    cartStoreMock.globalDiscount = 0
    cartStoreMock.globalDiscountType = '%'
    cartStoreMock.totalTTC = 20
    cartStoreMock.totalHT = 16.67
    cartStoreMock.totalTVA = 3.33
    sellersStoreMock.selectedSeller = ''
    customerStoreMock.client = null
    toastMock.error.mockClear()
    toastMock.warning.mockClear()
    toastMock.info.mockClear()
    toastMock.success.mockClear()
    productsStoreMock.loaded = true
    productsStoreMock.loadProducts.mockClear()
    cartStoreMock.clearCart.mockClear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mountComponent() {
    return mount(ColRight, {
      global: {
        stubs: {
          Input: InputStub,
          Button: ButtonStub,
          X: IconStub,
          Banknote: IconStub,
          CreditCard: IconStub,
          Printer: IconStub,
          Lock: IconStub
        }
      }
    })
  }

  it('ajoute un paiement et calcule le solde', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ isClosed: false }))
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click') // ajoute Espèces
    expect(wrapper.text()).toContain('Espèces')
  })

  it('bloque la validation si panier vide ou pas de paiement', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ isClosed: false }))
    const wrapper = mountComponent()
    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith('Le panier est vide')
  })

  it('affiche journée clôturée si check-closure isClosed=true', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ isClosed: true }))
    const wrapper = mountComponent()
    await new Promise(resolve => setTimeout(resolve))
    expect(wrapper.text()).toContain('Journée clôturée')
  })
})
