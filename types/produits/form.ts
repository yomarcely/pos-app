export interface ProductFormData {
  // Général
  name: string
  description: string
  supplierId: string | null
  brandId: string | null
  image: string | null

  // Prix
  price: string
  purchasePrice: string
  tva: string
  categoryId: string | null

  // Variations
  hasVariations: boolean
  variationGroupIds: number[]

  // Stock
  initialStock: number
  minStock: number
  initialStockByVariation: Record<number, number>
  minStockByVariation: Record<number, number>

  // Code-barres
  supplierCode: string
  barcode: string
  barcodeByVariation: Record<number, string>
}

export interface Supplier {
  id: number
  name: string
}

export interface Brand {
  id: number
  name: string
}

export interface Variation {
  id: number
  name: string
  groupId: number
}

export interface VariationGroup {
  id: number
  name: string
  variations: Variation[]
}
