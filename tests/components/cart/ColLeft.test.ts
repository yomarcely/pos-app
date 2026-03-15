import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ColLeft from '@/components/caisse/ColLeft.vue'

const SelectStub = {
  props: ['modelValue'],
  template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`
}
const ButtonStub = { template: `<button @click="$emit('click')"><slot /></button>` }
const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const BadgeStub = { template: '<span><slot /></span>' }
const SimpleStub = { template: '<div><slot /></div>' }
const IconStub = { template: '<span />' }
const ComboboxStub = {
  props: ['modelValue', 'options'],
  template: `<div><input @input="$emit('update:modelValue', options[0] || null)" /></div>`
}

// Stores mocks
const cartStoreMock = {
  items: [{ id: 1 }],
  globalDiscount: 0,
  globalDiscountType: '%',
  applyGlobalDiscountToItems: vi.fn(),
  addPendingCart: vi.fn(),
  pendingCart: [],
  clearCart: vi.fn()
}

const customerStoreMock = {
  clients: [{ id: 1, firstName: 'Client', lastName: 'Test', city: 'Paris' }],
  client: null as any,
  selectClient: vi.fn(),
  clearClient: vi.fn()
}

const sellersStoreMock = {
  sellers: [{ id: 1, name: 'Seller 1' }],
  selectedSeller: ''
}

vi.mock('@/stores/cart', () => ({
  useCartStore: () => cartStoreMock
}))
vi.mock('@/stores/customer', () => ({
  useCustomerStore: () => customerStoreMock
}))
vi.mock('@/stores/sellers', () => ({
  useSellersStore: () => sellersStoreMock
}))
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedEstablishmentId: { value: null },
    initialize: vi.fn().mockResolvedValue(undefined)
  })
}))

describe('ColLeft (caisse)', () => {
  beforeEach(() => {
    cartStoreMock.items = [{ id: 1 }]
    cartStoreMock.globalDiscount = 0
    cartStoreMock.globalDiscountType = '%'
    cartStoreMock.applyGlobalDiscountToItems.mockClear()
    cartStoreMock.addPendingCart.mockClear()
    customerStoreMock.client = null
    customerStoreMock.selectClient.mockClear()
    customerStoreMock.clearClient.mockClear()
    sellersStoreMock.selectedSeller = ''
  })

  function mountComponent() {
    return mount(ColLeft, {
      global: {
        stubs: {
          Select: SelectStub,
          SelectContent: SimpleStub,
          SelectTrigger: SimpleStub,
          SelectValue: SimpleStub,
          SelectItem: SimpleStub,
          Combobox: ComboboxStub,
          ComboboxAnchor: SimpleStub,
          ComboboxInput: SimpleStub,
          ComboboxList: SimpleStub,
          ComboboxItem: SimpleStub,
          ComboboxEmpty: SimpleStub,
          ComboboxGroup: SimpleStub,
          Dialog: SimpleStub,
          DialogTrigger: SimpleStub,
          Drawer: SimpleStub,
          DrawerContent: SimpleStub,
          DrawerHeader: SimpleStub,
          DrawerTitle: SimpleStub,
          DrawerDescription: SimpleStub,
          DrawerFooter: SimpleStub,
          DrawerClose: SimpleStub,
          Button: ButtonStub,
          Badge: BadgeStub,
          Input: InputStub,
          ContextMenu: SimpleStub,
          ContextMenuTrigger: SimpleStub,
          ContextMenuContent: SimpleStub,
          ContextMenuItem: SimpleStub,
          ContextMenuSeparator: SimpleStub,
          UserRoundPlus: IconStub,
          X: IconStub,
          User: IconStub,
          List: IconStub,
          ShoppingBag: IconStub,
          clientOnly: SimpleStub,
          CaisseAddClientForm: SimpleStub,
          CaissePendingCartForm: SimpleStub
        }
      }
    })
  }

  it('affiche le composant ColLeft correctement', async () => {
    const wrapper = mountComponent()
    // ColLeft renders the client section and the pending cart buttons
    expect(wrapper.exists()).toBe(true)
  })

  it('affiche le bouton Mise en attente', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    const pendingBtn = buttons.find(b => b.text().includes('Mise en attente'))
    expect(pendingBtn).toBeDefined()
  })

  it('met en attente un panier et clear client', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    const pendingBtn = buttons.find(b => b.text().includes('Mise en attente'))
    await pendingBtn?.trigger('click')
    expect(cartStoreMock.addPendingCart).toHaveBeenCalled()
    expect(customerStoreMock.clearClient).toHaveBeenCalled()
  })
})
