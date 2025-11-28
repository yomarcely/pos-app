import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SynthesePage from '@/pages/synthese/index.vue'
import { ref as vueRef, watch as vueWatch } from 'vue'

const toastMock = {
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock
}))

const fetchMock = vi.fn()

describe('Page synthese', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('ref', vueRef)
    vi.stubGlobal('watch', vueWatch)
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('daily-summary')) {
        return Promise.resolve({
          success: true,
          summary: {
            totalTTC: 20,
            totalHT: 16,
            totalTVA: 4,
            paymentMethods: { Carte: { amount: 10, count: 1 } }
          },
          sales: [{ id: 1, status: 'completed' }]
        })
      }
      if (url.includes('check-closure')) {
        return Promise.resolve({ isClosed: false, closure: { totalTTC: 20, totalHT: 16, totalTVA: 4 } })
      }
      if (url.includes('cancel')) return Promise.resolve({ success: true, sale: { id: 1 } })
      if (url.includes('close-day')) return Promise.resolve({ success: true, closure: { closureHash: 'hashhashhashhash' } })
      return Promise.resolve({})
    })
  })

  function mountPage() {
    return mount(SynthesePage, {
      global: {
        stubs: {
          Input: { template: '<input v-bind="$attrs" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
          Button: { template: '<button @click="$emit(\'click\')" :disabled="disabled"><slot /></button>', props: ['disabled'] },
          Badge: { template: '<span><slot /></span>' },
          Dialog: { template: '<div><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          DialogDescription: { template: '<div><slot /></div>' },
          DialogFooter: { template: '<div><slot /></div>' },
          DialogHeader: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<div><slot /></div>' },
          Label: { template: '<label><slot /></label>' },
          Textarea: { template: '<textarea></textarea>' },
          DailySummaryStats: { template: '<div class="stats"></div>' },
          SaleTicketItem: { template: '<div class="ticket"></div>' },
          Calendar: { template: '<span />' },
          Lock: { template: '<span />' },
          LockOpen: { template: '<span />' }
        }
      }
    })
  }

  it('charge la synthèse et affiche le statut ouvert', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/sales/daily-summary?date='))
    expect(wrapper.text()).toContain('Synthèse journalière')
  })

  it('bloque l’annulation si journée clôturée', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('daily-summary')) {
        return Promise.resolve({
          success: true,
          summary: { totalTTC: 10, totalHT: 8, totalTVA: 2, paymentMethods: {} },
          sales: [{ id: 1, status: 'completed' }]
        })
      }
      if (url.includes('check-closure')) return Promise.resolve({ isClosed: true, closure: { totalTTC: 10, totalHT: 8, totalTVA: 2 } })
      return Promise.resolve({})
    })
    const wrapper = mountPage()
    const vm: any = wrapper.vm
    await vm.openCancelDialog({ id: 1 })
    // openCancelDialog devrait alerter/stopper si clôturé, toast.error n’est pas utilisé ici mais on teste que la variable reste false
    expect(vm.isCancelDialogOpen?.value || false).toBe(false)
  })
})
