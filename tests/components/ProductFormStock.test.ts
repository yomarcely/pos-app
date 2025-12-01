import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFormStock from '@/components/produits/form/ProductFormStock.vue'

const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const SimpleStub = { template: '<div><slot /></div>' }
const IconStub = { template: '<span />' }

describe('ProductFormStock', () => {
  const baseProps = {
    hasVariations: false,
    initialStock: 0,
    minStock: 0,
    initialStockByVariation: {},
    minStockByVariation: {},
    selectedVariationsList: []
  }

  function mountComponent(propsOverride = {}) {
    return mount(ProductFormStock, {
      props: { ...baseProps, ...propsOverride },
      global: {
        stubs: {
          Card: SimpleStub,
          CardHeader: SimpleStub,
          CardTitle: SimpleStub,
          CardDescription: SimpleStub,
          CardContent: SimpleStub,
          Label: SimpleStub,
          Input: InputStub,
          Info: IconStub
        }
      }
    })
  }

  it('émet update:initialStock et minStock sans variations', async () => {
    const wrapper = mountComponent()
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('3')
    await inputs[1]!.setValue('1')

    const emits = wrapper.emitted()
    const initialStockEmit = emits['update:initialStock'] as any[] | undefined
    const minStockEmit = emits['update:minStock'] as any[] | undefined
    expect(initialStockEmit?.[0]?.[0]).toBe(3)
    expect(minStockEmit?.[0]?.[0]).toBe(1)
  })

  it('gère le stock par variation', async () => {
    const wrapper = mountComponent({
      hasVariations: true,
      selectedVariationsList: [
        { id: 1, name: 'Red' },
        { id: 2, name: 'Blue' }
      ],
      initialStockByVariation: { 1: 0, 2: 0 },
      minStockByVariation: { 1: 0, 2: 0 }
    })

    await wrapper.find('#stock-1').setValue('5')
    await wrapper.find('#min-stock-1').setValue('2')
    await wrapper.find('#stock-2').setValue('3')
    await wrapper.find('#min-stock-2').setValue('1')

    const emits = wrapper.emitted()
    const initEmits = (emits['update:initialStockByVariation'] as any[]) || []
    expect(initEmits[0]?.[0]).toEqual({ 1: 5, 2: 0 })
    expect(initEmits.at(-1)?.[0]).toEqual({ 1: 0, 2: 3 })

    const minEmits = (emits['update:minStockByVariation'] as any[]) || []
    expect(minEmits[0]?.[0]).toEqual({ 1: 2, 2: 0 })
    expect(minEmits.at(-1)?.[0]).toEqual({ 1: 0, 2: 1 })
  })
})
