import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CartItem from '@/components/caisse/CartItem.vue'
import type { ProductInCart } from '@/types'

// Mocks stores
const updateQuantity = vi.fn()
const updateDiscount = vi.fn()
const updateVariation = vi.fn()
vi.mock('@/stores/cart', () => ({
  useCartStore: () => ({
    updateQuantity,
    updateDiscount,
    updateVariation
  })
}))

vi.mock('@/stores/variationGroups', () => ({
  useVariationGroupsStore: () => ({
    groups: [{
      id: 1,
      name: 'Couleur',
      variations: [
        { id: 10, name: 'Rouge' },
        { id: 11, name: 'Bleu' }
      ]
    }]
  })
}))

const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const SelectStub = {
  props: ['modelValue'],
  template: `<select v-bind="$attrs" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`
}
const SelectItemStub = {
  props: ['value'],
  template: `<option :value="value"><slot /></option>`
}
const NumberFieldStub = {
  props: ['modelValue', 'min'],
  emits: ['update:modelValue'],
  template: `<div><button class="dec" @click="$emit('update:modelValue', (modelValue||1)-1)">-</button><input :value="modelValue" /><button class="inc" @click="$emit('update:modelValue', (modelValue||1)+1)">+</button></div>`
}
const SimpleStub = { template: '<div><slot /></div>' }
const IconStub = { template: '<span />' }
const RouterLinkStub = {
  props: ['to'],
  template: `<a><slot /></a>`
}

const baseProduct: ProductInCart = {
  id: 1,
  name: 'Prod',
  image: null,
  price: 10,
  tva: 20,
  quantity: 2,
  discount: 0,
  discountType: '%',
  variation: '',
  stock: 5
}

describe('CartItem', () => {
  beforeEach(() => {
    updateQuantity.mockClear()
    updateDiscount.mockClear()
    updateVariation.mockClear()
  })

  it('met à jour la quantité via NumberField', async () => {
    const wrapper = mount(CartItem, {
      props: { product: baseProduct },
      global: {
        stubs: {
          Input: InputStub,
          NumberField: NumberFieldStub,
          NumberFieldContent: SimpleStub,
          NumberFieldDecrement: SimpleStub,
          NumberFieldIncrement: SimpleStub,
          NumberFieldInput: SimpleStub,
          Select: SelectStub,
          SelectTrigger: SimpleStub,
          SelectValue: SimpleStub,
          SelectContent: SimpleStub,
          SelectItem: SelectItemStub,
          X: IconStub,
          RouterLink: RouterLinkStub
        }
      }
    })

    await wrapper.find('button.inc').trigger('click')
    expect(updateQuantity).toHaveBeenCalledWith(1, '', 3)
  })

  it('change le type de remise et le prix final', async () => {
    const wrapper = mount(CartItem, {
      props: { product: { ...baseProduct, discount: 10, discountType: '%' } },
      global: {
        stubs: {
          Input: InputStub,
          NumberField: NumberFieldStub,
          NumberFieldContent: SimpleStub,
          NumberFieldDecrement: SimpleStub,
          NumberFieldIncrement: SimpleStub,
          NumberFieldInput: SimpleStub,
          Select: SelectStub,
          SelectTrigger: SimpleStub,
          SelectValue: SimpleStub,
          SelectContent: SimpleStub,
          SelectItem: SelectItemStub,
          X: IconStub,
          RouterLink: RouterLinkStub
        }
      }
    })

    // Change le type de remise via select
    const selects = wrapper.findAll('select')
    const discountTypeSelect = selects.at(-1)!
    await discountTypeSelect.setValue('€')
    expect(updateDiscount).toHaveBeenCalled()
  })

  it('met à jour la variation sélectionnée', async () => {
    const wrapper = mount(CartItem, {
      props: { product: { ...baseProduct, variationGroupIds: [10, 11], variation: 'Rouge' } },
      global: {
        stubs: {
          Input: InputStub,
          NumberField: NumberFieldStub,
          NumberFieldContent: SimpleStub,
          NumberFieldDecrement: SimpleStub,
          NumberFieldIncrement: SimpleStub,
          NumberFieldInput: SimpleStub,
          Select: SelectStub,
          SelectTrigger: SimpleStub,
          SelectValue: SimpleStub,
          SelectContent: SimpleStub,
          SelectItem: SelectItemStub,
          X: IconStub,
          RouterLink: RouterLinkStub
        }
      }
    })

    const select = wrapper.findAll('select')[0]
    await select.setValue('Bleu')
    expect(updateVariation).toHaveBeenCalled()
    const lastCall = updateVariation.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe(1)
    expect(lastCall?.[1]).toBe('Rouge')
    expect(typeof lastCall?.[2]).toBe('string')
  })
})
