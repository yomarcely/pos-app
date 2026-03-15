import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
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
  totalTTC: ref(0),
  totalHT: ref(0),
  totalTVA: ref(0),
  checkDayClosure: vi.fn().mockResolvedValue(false),
  applyGlobalDiscountToItems: vi.fn()
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

const selectedRegisterId = ref<number | null>(null)

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
vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock
}))
vi.mock('@/composables/useFetchError', () => ({
  extractFetchError: (err: unknown, fallback: string) => fallback
}))
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedRegisterId,
    selectedRegister: ref(null),
    selectedEstablishmentDetail: ref(null),
    initialize: vi.fn().mockResolvedValue(undefined)
  })
}))

describe('ColRight (caisse)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cartStoreMock.items = []
    cartStoreMock.globalDiscount = 0
    cartStoreMock.globalDiscountType = '%'
    cartStoreMock.totalTTC = ref(20)
    cartStoreMock.totalHT = ref(16.67)
    cartStoreMock.totalTVA = ref(3.33)
    sellersStoreMock.selectedSeller = ''
    customerStoreMock.client = null
    toastMock.error.mockClear()
    toastMock.warning.mockClear()
    toastMock.info.mockClear()
    toastMock.success.mockClear()
    productsStoreMock.loaded = true
    productsStoreMock.loadProducts.mockClear()
    cartStoreMock.clearCart.mockClear()
    cartStoreMock.checkDayClosure.mockClear()
    cartStoreMock.checkDayClosure.mockResolvedValue(false)
    selectedRegisterId.value = null
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
          Lock: IconStub,
          Spinner: SimpleStub
        }
      }
    })
  }

  it('ajoute un paiement et calcule le solde', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click') // ajoute Espèces
    expect(wrapper.text()).toContain('Espèces')
  })

  it('bloque la validation si panier vide ou pas de paiement', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith('Le panier est vide')
  })

  it('affiche journée clôturée si checkDayClosure retourne true', async () => {
    // Set a register so checkClosure actually fires
    selectedRegisterId.value = 1
    cartStoreMock.checkDayClosure.mockResolvedValue(true)

    const wrapper = mountComponent()
    // Wait for onMounted async check
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Journée clôturée')
  })
})
