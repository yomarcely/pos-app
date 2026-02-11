import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import CaissePage from '@/pages/caisse/index.vue'

// Mocks des stores avec toutes les méthodes et propriétés nécessaires
const productsStoreMock = {
  loadProducts: vi.fn(),
  products: [],
  loading: false
}

const customerStoreMock = {
  loadCustomers: vi.fn(),
  customers: [],
  loading: false
}

const sellersStoreMock = {
  initialize: vi.fn().mockResolvedValue(undefined),
  loadSellers: vi.fn().mockResolvedValue(undefined),
  selectSellerById: vi.fn(),
  sellers: [],
  selectedSeller: null,
  loading: false
}

const variationStoreMock = {
  loadGroups: vi.fn(),
  variationGroups: [],
  loading: false
}

// Mock du composable useEstablishmentRegister
const selectedEstablishmentId = ref<number | null>(1)
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedEstablishmentId,
    selectedRegisterId: ref(null),
    establishments: ref([]),
    registers: ref([])
  })
}))

vi.mock('@/stores/products', () => ({ useProductsStore: () => productsStoreMock }))
vi.mock('@/stores/customer', () => ({ useCustomerStore: () => customerStoreMock }))
vi.mock('@/stores/sellers', () => ({ useSellersStore: () => sellersStoreMock }))
vi.mock('@/stores/variationGroups', () => ({ useVariationGroupsStore: () => variationStoreMock }))

const SimpleStub = { template: '<div></div>' }

describe('Page caisse', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    productsStoreMock.loadProducts.mockClear()
    customerStoreMock.loadCustomers.mockClear()
    sellersStoreMock.initialize.mockClear()
    sellersStoreMock.loadSellers.mockClear()
    variationStoreMock.loadGroups.mockClear()
  })

  it('charge produits/clients/vendeurs/variations au montage', async () => {
    const wrapper = mount(CaissePage, {
      global: {
        stubs: {
          CaisseHeader: SimpleStub,
          CaisseColLeft: SimpleStub,
          CaisseColMiddle: SimpleStub,
          CaisseColRight: SimpleStub
        }
      }
    })

    await wrapper.vm.$nextTick()
    expect(productsStoreMock.loadProducts).toHaveBeenCalled()
    expect(customerStoreMock.loadCustomers).toHaveBeenCalled()
    // Le store sellers utilise initialize() au montage, pas loadSellers() directement
    expect(sellersStoreMock.initialize).toHaveBeenCalled()
    expect(variationStoreMock.loadGroups).toHaveBeenCalled()
  })
})
