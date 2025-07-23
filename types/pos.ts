import type { ProductBase } from './product'

export interface ProductInCart extends ProductBase {
  quantity: number
  discount: number
  discountType: '%' | '€'
  variation: string
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
