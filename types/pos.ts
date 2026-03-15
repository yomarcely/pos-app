import type { Product as BaseProduct } from './product'

export interface EstablishmentDetail {
  id: number
  tenantId: string
  name: string
  address: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  siret: string | null
  naf: string | null
  tvaNumber: string | null
  isActive: boolean | null
  createdAt: string
  updatedAt: string
}

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

export interface SaleItem {
  productId: number
  productName: string
  quantity: number
  restockOnReturn: boolean
  unitPrice: number
  originalPrice: number
  variation: string | null
  discount: number
  discountType: '%' | '€'
  tva: number
}

export interface SalePayload {
  items: SaleItem[]
  seller: { id: number; name: string }
  customer: { id: number; firstName: string | null; lastName: string | null } | null
  payments: { mode: string; amount: number }[]
  totals: { totalHT: number; totalTVA: number; totalTTC: number }
  globalDiscount: { value: number; type: '%' | '€' }
  establishmentId: number
  registerId: number
}

export interface SaleRecord {
  ticketNumber: string
  saleDate: string
  hash: string
  signature?: string
}

export interface SaleResponse {
  success: boolean
  sale: SaleRecord
}
