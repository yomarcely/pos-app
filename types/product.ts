// Variation individuelle
export interface Variation {
  id: number
  name: string
  sortOrder: number
}

// Groupe de variation (ex: couleur, résistance, etc.)
export interface VariationGroup {
  id: number
  name: string
  variations: Variation[]
}

// Produit de base
export interface Product {
  id: number
  name: string
  image: string | null
  price: number
  barcode?: string
  barcodeByVariation?: Record<string, string> // { "variationId": "barcode" }
  tva: number
  variationGroupIds?: number[] // IDs des variations sélectionnées (pas des groupes!)
  stockByVariation?: Record<string, number>
  stock?: number
  minStock?: number
  minStockByVariation?: Record<string, number>
  purchasePrice?: number
}
