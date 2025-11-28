import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFormBarcode from '@/components/produits/form/ProductFormBarcode.vue'

const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const SimpleStub = { template: '<div><slot /></div>' }
const IconStub = { template: '<span />' }

describe('ProductFormBarcode', () => {
  const baseProps = {
    hasVariations: false,
    supplierCode: '',
    barcode: '',
    barcodeByVariation: {} as Record<number, string>,
    selectedVariationsList: [] as Array<{ id: number; name: string }>
  }

  function mountComponent(propsOverride = {}) {
    return mount(ProductFormBarcode, {
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

  it('émet supplierCode et barcode sans variations', async () => {
    const wrapper = mountComponent()
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('SUPP-1')
    await inputs[1]!.setValue('123456')

    const emits = wrapper.emitted()
    expect(emits['update:supplierCode']?.[0]?.[0]).toBe('SUPP-1')
    expect(emits['update:barcode']?.[0]?.[0]).toBe('123456')
  })

  it('gère les codes-barres par variation', async () => {
    const wrapper = mountComponent({
      hasVariations: true,
      selectedVariationsList: [
        { id: 1, name: 'Red' },
        { id: 2, name: 'Blue' }
      ],
      barcodeByVariation: { 1: 'A' }
    })

    // Simule la synchro parent en réinjectant les props après chaque emit
    await wrapper.find('#barcode-1').setValue('AAA')
    const firstEmit = (wrapper.emitted()['update:barcodeByVariation'] || []).at(-1)?.[0]
    await wrapper.setProps({ barcodeByVariation: firstEmit })

    await wrapper.find('#barcode-2').setValue('BBB')
    const latest = (wrapper.emitted()['update:barcodeByVariation'] || []).at(-1)?.[0] as Record<number, string> | undefined
    expect(latest?.[1]).toBe('AAA')
    expect(latest?.[2]).toBe('BBB')
  })
})
