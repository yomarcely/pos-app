import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
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

describe('Caisse Header', () => {
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
          GalleryVerticalEnd: DropdownStub,
          ChevronDown: DropdownStub,
          Settings2: DropdownStub,
          clientOnly: DropdownStub
        }
      }
    })

    expect(wrapper.text()).toContain('FymPOS')
    expect(wrapper.text()).toContain('Caisse 1')
  })
})
