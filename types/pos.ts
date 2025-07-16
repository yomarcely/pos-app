// Option de variation avec stock spécifique
export type VariationOption = {
  value: string // ex: "noir"
  label: string // ex: "Noir"
}

// Groupe de variation (ex: couleur, résistance, etc.)
export type VariationGroup = {
  id: string
  name: string
  options: VariationOption[]
}

// Produit de base
export type ProductBase = {
  id: number
  name: string
  image: string
  price: number
  barcode?: string

  // S'il y a des variations, on liste ici les groupes associés (ex: ["nicotine", "resistance"])
  variationGroupIds?: string[]

  // Stock selon la variation (ex: "3mg|0.15" → 12)
  stockByVariation?: Record<string, number>

  // Si le produit n’a pas de variation → stock global
  stock?: number, 
  purchasePrice?: number
}

// Produit ajouté au panier
export type ProductInCart = ProductBase & {
  quantity: number

  // Remise
  discount: number
  discountType: '%' | '€'

  // Combinaison de variations choisie (ex: "3mg|0.15")
  variation: string
}
