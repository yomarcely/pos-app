import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductsSearchBar from '@/components/produits/ProductsSearchBar.vue'

const stubButton = { template: '<button><slot /></button>' }
const stubInput = {
  template: `<input @input="$emit('update:modelValue', $event.target.value)" />`
}

describe('ProductsSearchBar', () => {
  const categories = [
    { id: 1, name: 'Cat 1' },
    { id: 2, name: 'Cat 2' }
  ]

  function mountComponent(propsOverride = {}) {
    return mount(ProductsSearchBar, {
      props: {
        searchQuery: '',
        selectedCategoryId: null,
        categories,
        viewMode: 'grid',
        ...propsOverride
      },
      global: {
        stubs: {
          Card: { template: '<div><slot /></div>' },
          CardContent: { template: '<div><slot /></div>' },
          Button: stubButton,
          Input: stubInput,
          Search: { template: '<span />' },
          List: { template: '<span />' },
          Grid: { template: '<span />' }
        }
      }
    })
  }

  it('émet update:searchQuery et search lors de la saisie', async () => {
    const wrapper = mountComponent()
    const input = wrapper.find('input')
    await input.setValue('abc')

    expect(wrapper.emitted()['update:searchQuery']?.[0]).toEqual(['abc'])
    expect(wrapper.emitted().search).toBeTruthy()
  })

  it('émet update:selectedCategoryId et categoryChange au changement de catégorie', async () => {
    const wrapper = mountComponent()
    const select = wrapper.find('select')
    await select.setValue('1')

    expect(wrapper.emitted()['update:selectedCategoryId']?.[0]).toEqual([1])
    expect(wrapper.emitted().categoryChange).toBeTruthy()
  })

  it('bascule la vue list/grid via les boutons', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    const listBtn = buttons.at(buttons.length - 2)!
    const gridBtn = buttons.at(buttons.length - 1)!

    await listBtn.trigger('click')
    await gridBtn.trigger('click')

    const emitted = wrapper.emitted()['update:viewMode'] || []
    expect(emitted.map(e => e[0])).toEqual(['list', 'grid'])
  })
})
