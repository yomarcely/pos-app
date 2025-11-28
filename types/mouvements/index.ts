import type { Product } from '../product'

export type {
  Product,
  Category,
  Supplier,
  Brand,
  Variation
} from '../product'

export interface SelectedProduct {
  product: Product
  variation?: string
  currentStock: number
  quantity: number
  quantitiesByVariation?: Record<string, number>
}

export type MovementType = 'entry' | 'adjustment' | 'loss'
