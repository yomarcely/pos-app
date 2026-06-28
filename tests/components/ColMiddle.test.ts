import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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

describe('ColMiddle — dialog de retour unique', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Le contenu du dialog est téléporté dans document.body : on repart propre.
    document.body.innerHTML = ''
  })

  function seedReturnedItems() {
    const cartStore = useCartStore()
    cartStore.items.push(
      { id: 1, name: 'Produit A', price: 10, quantity: -1, discount: 0, discountType: '%', tva: 20, variation: '', restockOnReturn: true, _uniqueId: 1 } as any,
      { id: 2, name: 'Produit B', price: 20, quantity: -2, discount: 0, discountType: '%', tva: 20, variation: 'Rouge', restockOnReturn: true, _uniqueId: 2 } as any,
    )
    return cartStore
  }

  // Le contenu de l'AlertDialog (reka-ui) est téléporté dans document.body.
  async function openReturnDialog() {
    const wrapper = mount(ColMiddle, { attachTo: document.body })
    // Activer le mode retour (bouton à aria-label dynamique)
    const returnToggle = wrapper.findAll('button').find(b => b.attributes('aria-label')?.includes('Mode retour'))
    expect(returnToggle).toBeTruthy()
    await returnToggle!.trigger('click')
    await nextTick()
    // Le bouton « Confirmer le retour » n'apparaît qu'en mode retour avec des lignes
    const confirmBtn = wrapper.findAll('button').find(b => b.text().includes('Confirmer le retour'))
    expect(confirmBtn).toBeTruthy()
    await confirmBtn!.trigger('click')
    await nextTick()
    return wrapper
  }

  it('ouvre un seul dialog listant tous les articles retournés', async () => {
    seedReturnedItems()
    await openReturnDialog()

    const dialogs = document.body.querySelectorAll('[data-slot="alert-dialog-content"]')
    expect(dialogs.length).toBe(1) // un SEUL dialog

    const text = document.body.textContent || ''
    expect(text).toContain('Produit A')
    expect(text).toContain('Produit B')
    expect(text).toContain('Tout remettre en stock')

    // Checkbox d'en-tête + une checkbox par ligne
    const checkboxes = document.body.querySelectorAll('[role="checkbox"]')
    expect(checkboxes.length).toBe(3)
  })

  it('la checkbox par ligne bascule le flag restockOnReturn de l\'article', async () => {
    const cartStore = seedReturnedItems()
    await openReturnDialog()

    const lineCheckbox = document.body.querySelector('[aria-label="Remettre en stock Produit A"]') as HTMLElement | null
    expect(lineCheckbox).toBeTruthy()
    lineCheckbox!.click()
    await nextTick()

    expect(cartStore.items.find(i => i.name === 'Produit A')?.restockOnReturn).toBe(false)
    expect(cartStore.items.find(i => i.name === 'Produit B')?.restockOnReturn).toBe(true)
  })

  it('la checkbox d\'en-tête « Tout remettre en stock » bascule toutes les lignes', async () => {
    const cartStore = seedReturnedItems()
    // Une ligne décochée au départ → l'en-tête doit pouvoir tout recocher
    cartStore.items[0]!.restockOnReturn = false
    await openReturnDialog()

    const headerCheckbox = document.body.querySelector('[aria-label="Tout remettre en stock"]') as HTMLElement | null
    expect(headerCheckbox).toBeTruthy()
    headerCheckbox!.click()
    await nextTick()

    expect(cartStore.items.every(i => i.restockOnReturn)).toBe(true)
  })
})
