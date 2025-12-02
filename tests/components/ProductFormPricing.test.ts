import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFormPricing from '@/components/produits/form/ProductFormPricing.vue'

const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const SelectStub = {
  props: ['modelValue'],
  template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`
}
const SelectItemStub = {
  props: ['value'],
  template: `<option :value="value"><slot /></option>`
}
const ButtonStub = { template: `<button @click="$emit('click')"><slot /></button>` }
const SimpleStub = { template: '<div><slot /></div>' }
const IconStub = { template: '<span />' }

describe('ProductFormPricing', () => {
  const categories = [{ id: 1, name: 'Cat' }]
  const form = {
    price: '10',
    purchasePrice: '5',
    tva: '20',
    categoryId: null as string | null
  }

  function mountComponent() {
    return mount(ProductFormPricing, {
      props: { form, categories },
      global: {
        stubs: {
          Card: SimpleStub,
          CardHeader: SimpleStub,
          CardTitle: SimpleStub,
          CardDescription: SimpleStub,
          CardContent: SimpleStub,
          Label: SimpleStub,
          Input: InputStub,
          Button: ButtonStub,
          Select: SelectStub,
          SelectTrigger: SimpleStub,
          SelectContent: SimpleStub,
          SelectItem: SelectItemStub,
          SelectValue: SimpleStub,
          Plus: IconStub
        }
      }
    })
  }

  it('émet update:form pour prix/achat/tva/catégorie', async () => {
    const wrapper = mountComponent()
    const purchaseInput = wrapper.find('input#purchasePrice')
    const priceInput = wrapper.find('input#price')
    expect(purchaseInput.exists()).toBe(true)
    expect(priceInput.exists()).toBe(true)

    await priceInput.setValue('15')
    await purchaseInput.setValue('7')

    const emits = (wrapper.emitted()['update:form'] as any[]) || []
    const priceUpdate = emits.find((e: any) => e[0]?.price === '15')
    const purchaseUpdate = emits.find((e: any) => e[0]?.purchasePrice === '7')
    expect(priceUpdate?.[0]?.price).toBe('15')
    expect(purchaseUpdate?.[0]?.purchasePrice).toBe('7')
  })

  it('affiche la marge et le taux', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('5.00') // marge brute 10-5
    expect(wrapper.text()).toContain('100.00%') // marge / achat
  })
})
