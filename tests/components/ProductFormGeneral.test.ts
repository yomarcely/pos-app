import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFormGeneral from '@/components/produits/form/ProductFormGeneral.vue'

const InputStub = {
  props: ['modelValue'],
  template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const TextareaStub = {
  props: ['modelValue'],
  template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)"></textarea>`
}
const SelectStub = {
  props: ['modelValue'],
  template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`
}
const SelectItemStub = {
  props: ['value'],
  template: `<option :value="value"><slot /></option>`
}
const ButtonStub = { template: `<button @click="$emit('click', $event)"><slot /></button>` }
const SimpleStub = { template: '<div><slot /></div>' }
const IconStub = { template: '<span />' }

describe('ProductFormGeneral', () => {
  const baseForm = {
    name: '',
    description: '',
    supplierId: null,
    brandId: null,
    image: null
  }
  const suppliers = [{ id: 1, name: 'Supp' }]
  const brands = [{ id: 2, name: 'Brand' }]

  it('émet update:form lors de la saisie nom/description', async () => {
    const wrapper = mount(ProductFormGeneral, {
      props: { form: baseForm, suppliers, brands },
      global: {
        stubs: {
          Card: SimpleStub,
          CardHeader: SimpleStub,
          CardTitle: SimpleStub,
          CardDescription: SimpleStub,
          CardContent: SimpleStub,
          Label: SimpleStub,
          Input: InputStub,
          Textarea: TextareaStub,
          Button: ButtonStub,
          Select: SelectStub,
          SelectTrigger: SimpleStub,
          SelectContent: SimpleStub,
          SelectItem: SelectItemStub,
          SelectValue: SimpleStub,
          Plus: IconStub,
          Upload: IconStub,
          X: IconStub,
          Image: IconStub
        }
      }
    })

    await wrapper.find('input#name').setValue('Produit X')
    await wrapper.find('textarea#description').setValue('Desc')

    const emits = wrapper.emitted()['update:form'] || []
    expect(emits.at(-2)?.[0].name).toBe('Produit X')
    expect(emits.at(-1)?.[0].description).toBe('Desc')
  })

  it('met à jour fournisseur/marque via Select', async () => {
    const wrapper = mount(ProductFormGeneral, {
      props: { form: baseForm, suppliers, brands },
      global: {
        stubs: {
          Card: SimpleStub,
          CardHeader: SimpleStub,
          CardTitle: SimpleStub,
          CardDescription: SimpleStub,
          CardContent: SimpleStub,
          Label: SimpleStub,
          Input: InputStub,
          Textarea: TextareaStub,
          Button: ButtonStub,
          Select: SelectStub,
          SelectTrigger: SimpleStub,
          SelectContent: SimpleStub,
          SelectItem: SelectItemStub,
          SelectValue: SimpleStub,
          Plus: IconStub,
          Upload: IconStub,
          X: IconStub,
          Image: IconStub
        }
      }
    })

    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(2)
    await selects[0]!.setValue('1')
    await selects[1]!.setValue('2')

    const emits = wrapper.emitted()['update:form'] || []
    expect(emits.some(e => e[0].supplierId !== null)).toBe(true)
    expect(emits.some(e => e[0].brandId !== null)).toBe(true)
  })

  it('supprime une image existante', async () => {
    const wrapper = mount(ProductFormGeneral, {
      props: { form: { ...baseForm, image: 'data:image/png;base64,abc' }, suppliers, brands },
      global: {
        stubs: {
          Card: SimpleStub,
          CardHeader: SimpleStub,
          CardTitle: SimpleStub,
          CardDescription: SimpleStub,
          CardContent: SimpleStub,
          Label: SimpleStub,
          Input: InputStub,
          Textarea: TextareaStub,
          Button: ButtonStub,
          Select: SelectStub,
          SelectTrigger: SimpleStub,
          SelectContent: SimpleStub,
          SelectItem: SelectItemStub,
          SelectValue: SimpleStub,
          Plus: IconStub,
          Upload: IconStub,
          X: IconStub,
          Image: IconStub
        }
      }
    })

    const buttons = wrapper.findAll('button')
    const removeBtn = buttons.at(-1)!
    await removeBtn.trigger('click')
    const emitted = wrapper.emitted()['update:form'] || []
    const last = emitted.at(-1)?.[0]
    expect(last?.image).toBeNull()
  })
})
