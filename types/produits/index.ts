export interface Product {
  id: number
  name: string
  barcode: string
  categoryId: number | null
  categoryName: string | null
  price: number
  purchasePrice?: number
  tva: number
  stock: number
  stockByVariation?: Record<string, number>
  image: string | null
  description: string
  isArchived: boolean | null
}

export interface Category {
  id: number
  name: string
}
