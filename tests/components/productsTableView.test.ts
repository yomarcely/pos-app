import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductsTableView from '@/components/produits/ProductsTableView.vue'

const stubButton = { template: `<button @click="$emit('click')"><slot /></button>` }
const stubCard = { template: '<div><slot /></div>' }

const product = {
  id: 1,
  name: 'Produit A',
  barcode: '123',
  categoryName: 'Cat',
  price: 10,
  tva: 20,
  image: null,
  stock: 5,
  stockByVariation: { a: 1, b: 2 }
}

describe('ProductsTableView', () => {
  function mountComponent() {
    return mount(ProductsTableView, {
      props: {
        products: [product]
      },
      global: {
        stubs: {
          Card: stubCard,
          CardContent: stubCard,
          Button: stubButton,
          Package: { template: '<span />' },
          Eye: { template: '<span />' },
          Edit: { template: '<span />' },
          Trash2: { template: '<span />' }
        }
      }
    })
  }

  it('calcule le stock total incluant les variations', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('3') // 1+2
  })

  it('émet view/edit/delete', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(3)
    const viewBtn = buttons.at(buttons.length - 3)!
    const editBtn = buttons.at(buttons.length - 2)!
    const delBtn = buttons.at(buttons.length - 1)!

    await viewBtn.trigger('click')
    await editBtn.trigger('click')
    await delBtn.trigger('click')

    const viewEmit = wrapper.emitted().view as any[] | undefined
    const editEmit = wrapper.emitted().edit as any[] | undefined
    const deleteEmit = wrapper.emitted().delete as any[] | undefined
    expect(viewEmit?.[0]?.[0].id).toBe(1)
    expect(editEmit?.[0]?.[0].id).toBe(1)
    expect(deleteEmit?.[0]?.[0].id).toBe(1)
  })
})
