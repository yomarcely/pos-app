import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductsSearchBar from '@/components/produits/ProductsSearchBar.vue'

const stubButton = { template: '<button><slot /></button>' }
const stubInput = {
  template: `<input @input="$emit('update:modelValue', $event.target.value)" />`
}
const stubCategorySelector = {
  template: '<div class="category-selector" />',
  props: ['categories', 'modelValue', 'showLabel', 'clearable', 'placeholder'],
  emits: ['update:modelValue'],
}
const stubSearchableSelect = {
  template: '<div class="searchable-select" />',
  props: ['modelValue', 'items', 'placeholder', 'searchPlaceholder', 'emptyText'],
  emits: ['update:modelValue'],
}
const stubCheckbox = { template: '<input type="checkbox" />' }

describe('ProductsSearchBar', () => {
  const categories = [
    { id: 1, name: 'Cat 1', parentId: null },
    { id: 2, name: 'Cat 2', parentId: null }
  ]

  function mountComponent(propsOverride = {}) {
    return mount(ProductsSearchBar, {
      props: {
        searchQuery: '',
        selectedCategoryId: null,
        selectedBrandId: null,
        selectedSupplierId: null,
        showArchived: false,
        categories,
        brands: [],
        suppliers: [],
        viewMode: 'grid',
        ...propsOverride
      },
      global: {
        stubs: {
          Card: { template: '<div><slot /></div>' },
          CardContent: { template: '<div><slot /></div>' },
          Button: stubButton,
          Input: stubInput,
          CategorySelector: stubCategorySelector,
          SearchableSelect: stubSearchableSelect,
          Checkbox: stubCheckbox,
          Search: { template: '<span />' },
          List: { template: '<span />' },
          Grid: { template: '<span />' },
          Archive: { template: '<span />' },
          X: { template: '<span />' }
        }
      }
    })
  }

  it('émet update:searchQuery et search lors de la saisie', async () => {
    const wrapper = mountComponent()
    const input = wrapper.find('input')
    await input.setValue('abc')

    const searchQueryEmit = (wrapper.emitted()['update:searchQuery'] as any[]) || []
    expect(searchQueryEmit[0]).toEqual(['abc'])
    expect(wrapper.emitted().search).toBeTruthy()
  })

  it('émet update:selectedCategoryId et categoryChange au changement de catégorie', async () => {
    const wrapper = mountComponent()
    const categorySelector = wrapper.findComponent(stubCategorySelector)
    await categorySelector.vm.$emit('update:modelValue', '1')

    const categoryEmit = (wrapper.emitted()['update:selectedCategoryId'] as any[]) || []
    expect(categoryEmit[0]).toEqual([1])
    expect(wrapper.emitted().categoryChange).toBeTruthy()
  })

  it('bascule la vue list/grid via les boutons', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    const listBtn = buttons.at(buttons.length - 2)!
    const gridBtn = buttons.at(buttons.length - 1)!

    await listBtn.trigger('click')
    await gridBtn.trigger('click')

    const emitted = (wrapper.emitted()['update:viewMode'] as any[]) || []
    expect(emitted.map((e: any) => e[0])).toEqual(['list', 'grid'])
  })
})
