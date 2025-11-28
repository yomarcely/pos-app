import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CaissePage from '@/pages/caisse/index.vue'

const productsStoreMock = { loadProducts: vi.fn() }
const customerStoreMock = { loadCustomers: vi.fn() }
const sellersStoreMock = { loadSellers: vi.fn() }
const variationStoreMock = { loadGroups: vi.fn() }

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
    expect(sellersStoreMock.loadSellers).toHaveBeenCalled()
    expect(variationStoreMock.loadGroups).toHaveBeenCalled()
  })
})
