// Option de variation avec stock spécifique
export interface VariationOption {
  value: string
  label: string
}

// Groupe de variation (ex: couleur, résistance, etc.)
export interface VariationGroup {
  id: string
  name: string
  options: VariationOption[]
}

// Produit de base
export interface ProductBase {
  id: number
  name: string
  image: string
  price: number
  barcode?: string
  tva: number
  variationGroupIds?: string[]
  stockByVariation?: Record<string, number>
  stock?: number
  purchasePrice?: number
}
