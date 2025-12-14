import type { Product as BaseProduct } from './product'

export interface ProductInCart extends BaseProduct {
  quantity: number
  discount: number
  discountType: '%' | '€'
  variation: string
  restockOnReturn?: boolean
}

export interface Ticket {
  id: number
  items: ProductInCart[]
  totalTTC: number
  clientId: number | null
  date: Date
}

export interface Seller {
  id: number
  name: string
}

export interface Payment {
  id: string,
  mode: 'Espèces'|'Carte'|'Autre',
  amount: number
}
