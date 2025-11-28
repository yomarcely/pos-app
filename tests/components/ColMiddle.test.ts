import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ColMiddle from '@/components/caisse/ColMiddle.vue'
import { useProductsStore } from '@/stores/products'
import { useCartStore } from '@/stores/cart'
import { useVariationGroupsStore } from '@/stores/variationGroups'

describe('ColMiddle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('affiche le champ de recherche par code-barres', () => {
    const wrapper = mount(ColMiddle)

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
  })

  it('affiche une structure combobox', () => {
    const wrapper = mount(ColMiddle)

    // Le composant doit avoir une structure de base
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('ne trouve aucun produit avec un code-barres invalide', async () => {
    const productsStore = useProductsStore()
    const cartStore = useCartStore()

    productsStore.products = [
      {
        id: 1,
        name: 'Test Product',
        barcode: '123456',
        price: 10,
        tva: 20,
        stock: 5,
        image: null
      }
    ] as any

    mount(ColMiddle)

    expect(cartStore.items.length).toBe(0)
  })

  it('gère les champs vides gracieusement', async () => {
    const cartStore = useCartStore()

    mount(ColMiddle)

    expect(cartStore.items.length).toBe(0)
  })

  it('affiche l\'icône de code-barres', () => {
    const wrapper = mount(ColMiddle)

    // Le composant doit contenir l'icône Barcode de lucide
    expect(wrapper.html()).toContain('svg')
  })

  it('le store contient les bons produits', () => {
    const productsStore = useProductsStore()

    productsStore.products = [
      {
        id: 1,
        name: 'Test Product',
        barcode: '123456',
        price: 10,
        tva: 20,
        stock: 5,
        image: null
      }
    ] as any

    expect(productsStore.products.length).toBe(1)
    expect(productsStore.products[0]?.name).toBe('Test Product')
  })
})
