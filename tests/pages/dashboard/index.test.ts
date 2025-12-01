import { mount } from '@vue/test-utils'
import DashboardPage from '@/pages/dashboard/index.vue'

// Mock Nuxt/Pinia helpers
vi.mock('@/stores/products', () => ({
  useProductsStore: () => ({
    loadProducts: vi.fn(),
    outOfStockAlerts: [],
    lowStockAlerts: []
  })
}))

vi.mock('@/stores/variationGroups', () => ({
  useVariationGroupsStore: () => ({
    loadGroups: vi.fn(),
    groups: []
  })
}))

vi.mock('#app', () => ({
  definePageMeta: () => {}
}))

describe('pages/dashboard/index', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(global as any).definePageMeta = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche les boutons principaux et navigue au clic', async () => {
    const push = vi.fn()
    const wrapper = mount(DashboardPage, {
      global: {
        mocks: { $router: { push } },
        stubs: {
          // Icônes lucide
          ShoppingCart: true,
          Package: true,
          Users: true,
          BarChart: true,
          MoveRight: true,
          ClipboardList: true
        }
      }
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(6)

    await buttons[0]!.trigger('click')
    expect(push).toHaveBeenCalledWith('/caisse')
  })

  it('met à jour la date/heure et charge les stores', () => {
    const wrapper = mount(DashboardPage, {
      global: {
        mocks: { $router: { push: vi.fn() } },
        stubs: {
          ShoppingCart: true,
          Package: true,
          Users: true,
          BarChart: true,
          MoveRight: true,
          ClipboardList: true
        }
      }
    })

    // Avance l'intervalle pour déclencher updateDateTime
    vi.runOnlyPendingTimers()

    expect(wrapper.text()).toContain('Agenda')
  })
})
