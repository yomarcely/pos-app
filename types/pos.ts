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
  variation: string // nom de la variation (affichage + clé de fusion panier)
  variationId?: number | null // ID de la variation (clé de stock côté serveur)
  restockOnReturn?: boolean
  _uniqueId?: number
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
  variation: string | null // nom de la variation (lisible, persisté sur la ligne de vente)
  variationId?: number | null // ID de la variation (utilisé par le serveur pour le stock)
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
  clientSaleId?: string | null
  loyaltyReward?: {
    type: 'percent_discount' | 'euro_discount' | 'voucher'
    value: number
    pointsToConsume: number
  } | null
  usedVoucherIds?: number[]
}

export interface SaleLoyaltyResponse {
  pointsEarned: number
  pointsConsumed: number
  pointsTotalAfter: number
  generatedVoucher: {
    code: string
    amount: number
    expiresAt: string | Date | null
  } | null
}

export interface SaleRecord {
  ticketNumber: string
  saleDate: string
  hash: string
  signature?: string
  loyalty?: SaleLoyaltyResponse | null
}

// Article vendu en survente : le stock est passé en négatif (la vente reste valide)
export interface StockWarning {
  productId: number
  productName: string
  variation: string | null
  remainingStock: number
}

export interface SaleResponse {
  success: boolean
  // true si le serveur a reconnu un clientSaleId déjà enregistré (rejeu) :
  // la vente retournée est celle d'origine, aucune nouvelle vente créée
  duplicate?: boolean
  stockWarnings?: StockWarning[]
  sale: SaleRecord
}
