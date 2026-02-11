import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VariationsPage from '@/pages/variations/index.vue'
import { ref as vueRef, onMounted as vueOnMounted, watch as vueWatch } from 'vue'

const toastMock = {
  error: vi.fn(),
  success: vi.fn()
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock
}))

// Mock du composable useEstablishmentRegister
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedEstablishmentId: vueRef(1),
    selectedRegisterId: vueRef(null),
    establishments: vueRef([]),
    registers: vueRef([]),
    initialize: vi.fn().mockResolvedValue(undefined)
  })
}))

const groupsMock = [
  { id: 1, name: 'Couleur', variations: [{ id: 10, name: 'Rouge', sortOrder: 1 }] }
]

const fetchMock = vi.fn()

describe('Page variations', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('ref', vueRef)
    vi.stubGlobal('onMounted', vueOnMounted)
    vi.stubGlobal('watch', vueWatch)
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string) => {
      // La page utilise /api/variations/groups, pas /api/variations
      if (url === '/api/variations/groups') return Promise.resolve({ groups: groupsMock })
      if (url.includes('/create')) return Promise.resolve({ success: true })
      if (url.includes('/update')) return Promise.resolve({ success: true })
      if (url.includes('/delete')) return Promise.resolve({ success: true })
      return Promise.resolve({})
    })
    toastMock.error.mockClear()
    toastMock.success.mockClear()
  })

  function mountPage() {
    return mount(VariationsPage, {
      global: {
        stubs: {
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          LoadingSpinner: { template: '<div class="loading"></div>' },
          EmptyState: { template: '<div class="empty"></div>' },
          FormDialog: { template: '<div><slot /></div>' },
          ConfirmDialog: { template: '<div></div>' },
          VariationGroupCard: { template: '<div class="card"><slot /></div>' },
          PageHeader: { template: '<div class="header"><slot name="actions" /></div>' },
          Plus: { template: '<span />' },
          Layers: { template: '<span />' }
        }
      }
    })
  }

  it('charge et affiche les groupes', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    // On vérifie que le bon endpoint est appelé
    expect(fetchMock).toHaveBeenCalledWith('/api/variations/groups', expect.anything())
  })

  it('crée un groupe via createGroup', async () => {
    const wrapper = mountPage()
    const vm: any = wrapper.vm
    vm.newGroupName = 'Taille'
    await vm.createGroup()
    expect(fetchMock).toHaveBeenCalledWith('/api/variations/groups/create', expect.anything())
    expect(toastMock.success).toHaveBeenCalled()
  })
})
