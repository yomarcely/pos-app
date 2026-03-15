import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import Header from '@/components/caisse/Header.vue'

const ButtonStub = { template: '<button><slot /></button>' }
const SelectStub = {
  props: ['modelValue', 'defaultValue'],
  template: `<select :value="defaultValue || modelValue"><slot /></select>`
}
const DropdownStub = {
  template: '<div><slot /></div>'
}
const TooltipStub = { template: '<div><slot /></div>' }
const SimpleStub = { template: '<div><slot /></div>' }
const IconStub = { template: '<span />' }

vi.mock('@/stores/sellers', () => ({
  useSellersStore: () => ({
    sellers: [{ id: 1, name: 'Vendeur 1' }],
    selectedSeller: ''
  })
}))

vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedEstablishmentId: { value: null },
    selectedRegisterId: { value: null },
    establishments: { value: [] },
    availableRegisters: { value: [] },
    initialize: vi.fn().mockResolvedValue(undefined)
  })
}))

describe('Caisse Header', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('affiche le nom de la caisse et le bouton paramètres', () => {
    const wrapper = mount(Header, {
      global: {
        stubs: {
          TooltipProvider: TooltipStub,
          Tooltip: TooltipStub,
          TooltipTrigger: TooltipStub,
          TooltipContent: TooltipStub,
          DropdownMenu: DropdownStub,
          DropdownMenuContent: DropdownStub,
          DropdownMenuItem: DropdownStub,
          DropdownMenuTrigger: DropdownStub,
          Select: SelectStub,
          SelectContent: DropdownStub,
          SelectGroup: DropdownStub,
          SelectItem: DropdownStub,
          SelectTrigger: DropdownStub,
          SelectValue: DropdownStub,
          Button: ButtonStub,
          GalleryVerticalEnd: IconStub,
          ChevronDown: IconStub,
          Settings2: IconStub,
          clientOnly: DropdownStub,
          EstablishmentSelect: SimpleStub,
          RegisterSelect: SimpleStub,
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    expect(wrapper.text()).toContain('FymPOS')
  })
})
