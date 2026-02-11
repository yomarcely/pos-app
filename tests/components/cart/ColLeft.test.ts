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

const sellerState = { value: '' }
const sellersStoreMock = {
  sellers: [{ id: 1, name: 'Seller 1' }],
  get selectedSeller() { return sellerState.value },
  set selectedSeller(val) { sellerState.value = val }
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
          clientOnly: SimpleStub,
          CaisseAddClientForm: SimpleStub,
          CaissePendingCartForm: SimpleStub
        }
      }
    })
  }

  it('sélectionne un vendeur', async () => {
    const wrapper = mountComponent()
    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
    sellersStoreMock.selectedSeller = '1'
    expect(sellersStoreMock.selectedSeller).toBe('1')
  })

  it('applique une remise globale', async () => {
    cartStoreMock.globalDiscount = 10
    const wrapper = mountComponent()
    const applyBtn = wrapper.findAll('button').find(b => b.text().includes('Appliquer'))
    await applyBtn?.trigger('click')
    expect(cartStoreMock.applyGlobalDiscountToItems).toHaveBeenCalled()
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
