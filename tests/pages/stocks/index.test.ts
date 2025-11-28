import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StocksPage from '@/pages/stocks/index.vue'
import { ref as vueRef, onMounted as vueOnMounted } from 'vue'

const productsStoreMock = {
  products: [
    { id: 1, name: 'P1', barcode: 'a', stock: 1, price: 10, tva: 20 },
    { id: 2, name: 'P2', barcode: 'b', stock: 0, price: 5, tva: 20 }
  ],
  lowStockAlerts: [{ product: { id: 1, name: 'P1', stock: 1 }, variations: [] }],
  outOfStockAlerts: [{ product: { id: 2, name: 'P2', stock: 0 }, variations: [] }],
  totalStockValue: { toFixed: () => '30.00' },
  loadProducts: vi.fn()
}

const variationStoreMock = {
  groups: [],
  loadGroups: vi.fn()
}

vi.mock('@/stores/products', () => ({
  useProductsStore: () => productsStoreMock
}))
vi.mock('@/stores/variationGroups', () => ({
  useVariationGroupsStore: () => variationStoreMock
}))

const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const ButtonStub = { template: '<button @click="$emit(\'click\')"><slot /></button>' }
const TableStub = { template: '<table><slot /></table>' }
const TableSectionStub = { template: '<tbody><slot /></tbody>' }
const TableRowStub = { template: '<tr><slot /></tr>' }
const TableCellStub = { template: '<td><slot /></td>' }
const IconStub = { template: '<span />' }

describe('Page stocks', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('ref', vueRef)
    vi.stubGlobal('onMounted', vueOnMounted)
    productsStoreMock.loadProducts.mockClear()
    variationStoreMock.loadGroups.mockClear()
  })

  it('charge les données au montage et affiche les stats', async () => {
    const wrapper = mount(StocksPage, {
      global: {
        stubs: {
          Input: InputStub,
          Button: ButtonStub,
          Table: TableStub,
          TableBody: TableSectionStub,
          TableHead: TableSectionStub,
          TableHeader: TableSectionStub,
          TableRow: TableRowStub,
          TableCell: TableCellStub,
          Badge: ButtonStub,
          Package: IconStub,
          TrendingUp: IconStub,
          AlertCircle: IconStub,
          PackageX: IconStub,
          ChevronDown: IconStub,
          ChevronRight: IconStub
        }
      }
    })

    await wrapper.vm.$nextTick()
    expect(productsStoreMock.loadProducts).toHaveBeenCalled()
    expect(variationStoreMock.loadGroups).toHaveBeenCalled()
    expect(wrapper.text()).toContain('État des stocks')
    expect(wrapper.text()).toContain('2') // total produits
    expect(wrapper.text()).toContain('30.00')
  })
})
