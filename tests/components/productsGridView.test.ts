import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductsGridView from '@/components/produits/ProductsGridView.vue'

const stubButton = { template: '<button @click="$emit(\'click\', $event)"><slot /></button>' }
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

describe('ProductsGridView', () => {
  function mountComponent() {
    return mount(ProductsGridView, {
      props: {
        products: [product]
      },
      global: {
        stubs: {
          Card: stubCard,
          CardContent: stubCard,
          Button: stubButton,
          Package: { template: '<span />' },
          Edit: { template: '<span />' },
          Trash2: { template: '<span />' }
        }
      }
    })
  }

  it('affiche le prix et le stock total (variations incluses)', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('3') // 1+2
  })

  it('émet edit/delete sur clic des boutons', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    const editBtn = buttons.at(buttons.length - 2)!
    const delBtn = buttons.at(buttons.length - 1)!

    const event = { stopPropagation: () => {} }
    await editBtn.trigger('click', event)
    await delBtn.trigger('click', event)

    const editEmit = wrapper.emitted().edit as any[] | undefined
    const deleteEmit = wrapper.emitted().delete as any[] | undefined
    expect(editEmit?.[0]?.[0].id).toBe(1)
    expect(deleteEmit?.[0]?.[0].id).toBe(1)
  })
})
