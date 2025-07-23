import { defineStore } from 'pinia'
import type { ProductBase } from '@/types'

export const useProductsStore = defineStore('products', {
  //state: () => ({
    // products: [] as ProductBase[],
    //loaded: false
  //}),
  state: () => ({
    products: [
      {
        id: 1,
        name: 'Freeze Fruit du Dragon 50ml',
        price: 14.90,
        image: '/assets/img/freeze-dragon.png',
        barcode: '1234567890123',
        stock: 10,
        purchasePrice: 8.9,
        tva: 20
      },
      {
        id: 2,
        name: 'Booster 50/50',
        price: 1,
        image: '/assets/img/booster.png',
        stock: 400,
        purchasePrice: 0.2,
        tva: 20
      },
      {
        id: 3,
        name: '-20 GeekVape Serie Z',
        price: 3.5,
        variationGroupIds: ['resistance'],
        image: '/assets/img/series-z.png',
        stockByVariation: {
          '0.15': 10,
          '0.2': 18
        },
        purchasePrice: 1,
        tva: 20
      },
      {
        id: 4,
        name: '-20 GeekVape Serie B',
        price: 3.5,
        variationGroupIds: ['resistance'],
        image: '/assets/img/series-z.png',
        stockByVariation: {
          '0.15': 8,
          '0.2': 3
        },
        purchasePrice: 1,
        tva: 20
      },
      {
        id: 5,
        name: 'GeekVape Z nano 2',
        price: 24.90,
        variationGroupIds: ['color'],
        image: '/assets/img/z-nano.png',
        stockByVariation: {
          noir: 4,
          bleu: 2,
          vert: 7
        },
        purchasePrice: 12,
        tva: 20
      },
      {
        id: 6,
        name: 'Pulp Cerise Glacée 10ml',
        price: 5.90,
        variationGroupIds: ['nicotine'],
        image: '/assets/img/pulp-cerise.png',
        stockByVariation: {
          '0mg': 10,
          '3mg': 0,
          '6mg': 6
        },
        purchasePrice: 2.5,
        tva: 20
      }
    ] as ProductBase[],
    loaded: true
  }),

  getters: {
    getById: (state) => (id: number): ProductBase | undefined =>
      state.products.find(p => p.id === id)
  },

  actions: {
    async loadProducts() {
      if (this.loaded) return
      try {
        const res = await fetch('/api/products')
        this.products = await res.json()
        this.loaded = true
      } catch (err) {
        console.error('Erreur chargement produits', err)
      }
    }
  }
})
