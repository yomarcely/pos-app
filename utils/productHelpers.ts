import type { Product as BaseProduct } from '@/types/product'

/**
 * Interface produit générique pour les helpers
 * (réutilise le type principal pour éviter la dérive de définitions)
 */
export type Product = Omit<BaseProduct, 'variationGroupIds' | 'stockByVariation'> & {
  stock: number
  stockByVariation?: Record<string, number>
  variationGroupIds?: Array<number | string>
  minStock?: number
  minStockByVariation?: Record<string, number>
  [key: string]: any
}

/**
 * Calcule le stock total d'un produit (avec ou sans variations)
 * @param product - Produit à analyser
 * @returns Stock total
 */
export function getTotalStock(product: Product): number {
  if (product.stockByVariation && Object.keys(product.stockByVariation).length > 0) {
    return Object.values(product.stockByVariation).reduce((sum, qty) => sum + Number(qty || 0), 0)
  }
  return Number(product.stock || 0)
}

/**
 * Vérifie si un produit a des variations
 * @param product - Produit à vérifier
 * @returns True si le produit a des variations
 */
export function hasVariations(product: Product): boolean {
  return Boolean(
    product.variationGroupIds &&
    Array.isArray(product.variationGroupIds) &&
    product.variationGroupIds.length > 0
  )
}

/**
 * Normalise un produit provenant de l'API pour garantir la cohérence des types
 * @param raw - Données brutes du produit
 * @returns Produit normalisé
 */
export function normalizeProduct(raw: any): Product {
  const normalizedVariationIds = Array.isArray(raw.variationGroupIds)
    ? raw.variationGroupIds.map((id: any) => {
        const numericId = Number(id)
        return Number.isFinite(numericId) ? numericId : String(id)
      })
    : []

  const normalizedStockByVariation = raw.stockByVariation
    ? Object.fromEntries(
        Object.entries(raw.stockByVariation as Record<string, number | string>).map(([key, value]) => [
          key.toString(),
          Number(value) || 0,
        ]),
      )
    : undefined

  const normalizedMinStockByVariation = raw.minStockByVariation
    ? Object.fromEntries(
        Object.entries(raw.minStockByVariation as Record<string, number | string>).map(([key, value]) => [
          key.toString(),
          Number(value) || 0,
        ]),
      )
    : undefined

  return {
    ...raw,
    id: Number(raw.id),
    name: String(raw.name ?? ''),
    barcode: String(raw.barcode ?? ''),
    stock: Number(raw.stock ?? 0),
    price: Number(raw.price ?? 0),
    tva: Number.isFinite(Number(raw.tva)) ? Number(raw.tva) : 20,
    variationGroupIds: normalizedVariationIds,
    stockByVariation: normalizedStockByVariation,
    minStockByVariation: normalizedMinStockByVariation,
    minStock: Number(raw.minStock ?? 0),
  }
}

/**
 * Vérifie si un produit est en rupture de stock
 * @param product - Produit à vérifier
 * @param threshold - Seuil de rupture (défaut: 0)
 * @returns True si le produit est en rupture
 */
export function isOutOfStock(product: Product, threshold: number = 0): boolean {
  return getTotalStock(product) <= threshold
}

/**
 * Vérifie si un produit est en alerte stock faible
 * @param product - Produit à vérifier
 * @returns True si le stock est inférieur au seuil minimum
 */
export function isLowStock(product: Product): boolean {
  const minStock = product.minStock ?? 0
  const hasMinByVariation = hasVariations(product) && product.minStockByVariation

  if (hasMinByVariation) {
    // Vérifie si au moins une variation est en alerte
    return Object.entries(product.stockByVariation || {}).some(([variationId, stock]) => {
      const minStockForVariation = product.minStockByVariation?.[variationId] || 0
      return minStockForVariation > 0 && stock <= minStockForVariation
    })
  }

  if (minStock > 0) {
    return getTotalStock(product) <= minStock
  }

  return false
}

/**
 * Calcule le prix TTC d'un produit
 * @param priceHT - Prix HT
 * @param tva - Taux de TVA en pourcentage (ex: 20)
 * @returns Prix TTC
 */
export function calculatePriceTTC(priceHT: number, tva: number): number {
  return Math.round(priceHT * (1 + tva / 100) * 100) / 100
}

/**
 * Calcule le prix HT à partir du prix TTC
 * @param priceTTC - Prix TTC
 * @param tva - Taux de TVA en pourcentage (ex: 20)
 * @returns Prix HT
 */
export function calculatePriceHT(priceTTC: number, tva: number): number {
  return Math.round((priceTTC / (1 + tva / 100)) * 100) / 100
}
