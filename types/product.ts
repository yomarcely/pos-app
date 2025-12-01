// Variation individuelle
export interface Variation {
  id: number | string
  name: string
  sortOrder?: number | null
  groupId?: number | string
}

// Groupe de variation (ex: couleur, résistance, etc.)
export interface VariationGroup {
  id: number | string
  name: string
  variations: Variation[]
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

// Produit unifié (catalogue, panier, mouvements)
export interface Product {
  id: number
  name: string
  description?: string
  image: string | null
  price: number
  purchasePrice?: number
  tva: number
  barcode?: string
  barcodeByVariation?: Record<string, string> // { "variationId": "barcode" }
  categoryId?: number | null
  categoryName?: string | null
  supplierId?: number | null
  supplierName?: string | null
  brandId?: number | null
  brandName?: string | null
  variationGroupIds?: Array<number | string> // IDs des variations sélectionnées (pas des groupes)
  stock?: number
  stockByVariation?: Record<string, number>
  minStock?: number
  minStockByVariation?: Record<string, number>
  isArchived?: boolean | null
}

// Données de formulaire produit (création/édition)
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
  variationGroupIds: Array<number | string>

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
