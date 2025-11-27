export interface Product {
  id: number
  name: string
  barcode: string
  categoryId: number | null
  categoryName: string | null
  supplierId: number | null
  supplierName?: string | null
  brandId: number | null
  brandName?: string | null
  price: number
  purchasePrice?: number
  stock: number
  stockByVariation?: Record<string, number>
  variationGroupIds?: Array<number | string>
  image: string | null
}

export interface SelectedProduct {
  product: Product
  variation?: string
  currentStock: number
  quantity: number
  quantitiesByVariation?: Record<string, number>
}

export interface Variation {
  id: number | string
  name: string
}

export interface Category {
  id: number
  name: string
}

export interface Supplier {
  id: number
  name: string
}

export interface Brand {
  id: number
  name: string
}

export type MovementType = 'entry' | 'adjustment' | 'loss'
