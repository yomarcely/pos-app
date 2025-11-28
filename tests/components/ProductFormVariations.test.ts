import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFormVariations from '@/components/produits/form/ProductFormVariations.vue'

const SimpleStub = { template: '<div><slot /></div>' }
const CheckboxStub = {
  props: ['checked'],
  template: `<input type="checkbox" :checked="checked" @change="$emit('update:checked', $event.target.checked)" />`
}
const BadgeStub = { template: '<span><slot /></span>' }
const IconStub = { template: '<span />' }

const variationGroups = [
  {
    id: 1,
    name: 'Couleur',
    variations: [
      { id: 10, name: 'Rouge' },
      { id: 11, name: 'Bleu' }
    ]
  },
  {
    id: 2,
    name: 'Taille',
    variations: [{ id: 20, name: 'S' }]
  }
]

describe('ProductFormVariations', () => {
  function mountComponent(propsOverride = {}) {
    return mount(ProductFormVariations, {
      props: {
        hasVariations: true,
        variationGroups,
        selectedGroupId: 1,
        selectedVariationsIds: [10],
        ...propsOverride
      },
      global: {
        stubs: {
          Card: SimpleStub,
          CardHeader: SimpleStub,
          CardTitle: SimpleStub,
          CardDescription: SimpleStub,
          CardContent: SimpleStub,
          Label: SimpleStub,
          Checkbox: CheckboxStub,
          Badge: BadgeStub,
          Info: IconStub,
          Layers: IconStub,
          X: IconStub
        }
      }
    })
  }

  it('émet update:selectedGroupId', async () => {
    const wrapper = mountComponent()
    const select = wrapper.find('select')
    await select.setValue('2')
    expect(wrapper.emitted()['update:selectedGroupId']?.[0]?.[0]).toBe(2)
  })

  it('toggleVariation ajoute/retire les ids sélectionnés', async () => {
    const wrapper = mountComponent({ selectedVariationsIds: [10] })
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[1]!.setValue(true) // ajoute Bleu

    const emitted = wrapper.emitted()['update:selectedVariationsIds'] || []
    const last = emitted.at(-1)?.[0] || []
    expect(last.sort()).toEqual([10, 11])
  })
})
