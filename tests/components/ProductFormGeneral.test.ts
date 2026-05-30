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
// SearchableSelect remplace Select/SelectItem : on l'expose comme une simple
// liste de boutons cliquables pour simuler la sélection dans les tests.
const SearchableSelectStub = {
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template: `
    <div class="searchable-select">
      <button
        v-for="item in items"
        :key="item.id"
        :data-id="item.id"
        type="button"
        @click="$emit('update:modelValue', item.id)"
      >{{ item.label }}</button>
    </div>
  `
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
          SearchableSelect: SearchableSelectStub,
          Plus: IconStub,
          Upload: IconStub,
          X: IconStub,
          Image: IconStub
        }
      }
    })

    await wrapper.find('input#name').setValue('Produit X')
    await wrapper.find('textarea#description').setValue('Desc')

    const emits = (wrapper.emitted()['update:form'] as any[]) || []
    expect(emits.at(-2)?.[0]?.name).toBe('Produit X')
    expect(emits.at(-1)?.[0]?.description).toBe('Desc')
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
          SearchableSelect: SearchableSelectStub,
          Plus: IconStub,
          Upload: IconStub,
          X: IconStub,
          Image: IconStub
        }
      }
    })

    const dropdowns = wrapper.findAll('.searchable-select')
    expect(dropdowns.length).toBeGreaterThanOrEqual(2)
    // 1er dropdown = fournisseurs, 2e = marques
    await dropdowns[0]!.find('button[data-id="1"]').trigger('click')
    await dropdowns[1]!.find('button[data-id="2"]').trigger('click')

    const emits = (wrapper.emitted()['update:form'] as any[]) || []
    expect(emits.some((e: any) => e[0]?.supplierId === '1')).toBe(true)
    expect(emits.some((e: any) => e[0]?.brandId === '2')).toBe(true)
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
          SearchableSelect: SearchableSelectStub,
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
    const emitted = (wrapper.emitted()['update:form'] as any[]) || []
    const last = emitted.at(-1)?.[0]
    expect(last?.image).toBeNull()
  })
})
