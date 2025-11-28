import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StockAlerts from '@/components/caisse/StockAlerts.vue'

const BadgeStub = { template: '<span><slot /></span>' }
const ButtonStub = { template: '<button @click="$emit(\'click\')"><slot /></button>' }
const IconStub = { template: '<span />' }
const TransitionStub = {
  render() { return this.$slots.default?.() }
}

const productsStoreMock = {
  outOfStockAlerts: [] as any[],
  lowStockAlerts: [] as any[]
}

vi.mock('@/stores/products', () => ({
  useProductsStore: () => productsStoreMock
}))

describe('StockAlerts', () => {
  beforeEach(() => {
    productsStoreMock.outOfStockAlerts = []
    productsStoreMock.lowStockAlerts = []
  })

  function mountComponent() {
    return mount(StockAlerts, {
      global: {
        stubs: {
          Badge: BadgeStub,
          Button: ButtonStub,
          AlertCircle: IconStub,
          PackageX: IconStub,
          X: IconStub,
          ChevronUp: IconStub,
          ChevronDown: IconStub,
          Transition: TransitionStub
        }
      }
    })
  }

  it('affiche le badge avec le nombre total', () => {
    productsStoreMock.outOfStockAlerts = [{ product: { id: 1, name: 'A', stock: 0 } }]
    productsStoreMock.lowStockAlerts = [{ product: { id: 2, name: 'B', stock: 2 } }]
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
  })

  it('peut être replié et fermé', async () => {
    productsStoreMock.outOfStockAlerts = [{ product: { id: 1, name: 'A', stock: 0 } }]
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click') // toggle
    await buttons[1]!.trigger('click') // close
    expect(wrapper.html()).not.toContain('Alertes de stock')
  })
})
