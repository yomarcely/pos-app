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
          Trash2: { template: '<span />' },
          Copy: { template: '<span />' },
          Archive: { template: '<span />' },
          ArchiveRestore: { template: '<span />' }
        }
      }
    })
  }

  it('calcule le stock total incluant les variations', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('3') // 1+2
  })

  it('émet view/edit/delete/duplicate/archive', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    // Buttons: view, edit, duplicate, archive, delete (5 action buttons per row)
    expect(buttons.length).toBeGreaterThanOrEqual(5)
    const actionButtons = buttons.slice(-5)
    const viewBtn = actionButtons[0]!
    const editBtn = actionButtons[1]!
    const duplicateBtn = actionButtons[2]!
    const archiveBtn = actionButtons[3]!
    const delBtn = actionButtons[4]!

    await viewBtn.trigger('click')
    await editBtn.trigger('click')
    await duplicateBtn.trigger('click')
    await archiveBtn.trigger('click')
    await delBtn.trigger('click')

    expect((wrapper.emitted().view as any[])?.[0]?.[0].id).toBe(1)
    expect((wrapper.emitted().edit as any[])?.[0]?.[0].id).toBe(1)
    expect((wrapper.emitted().duplicate as any[])?.[0]?.[0].id).toBe(1)
    expect((wrapper.emitted().archive as any[])?.[0]?.[0].id).toBe(1)
    expect((wrapper.emitted().delete as any[])?.[0]?.[0].id).toBe(1)
  })
})
