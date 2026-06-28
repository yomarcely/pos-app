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
  [key: string]: unknown
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
export function normalizeProduct(raw: unknown): Product {
  const data = (raw ?? {}) as Record<string, unknown>
  const normalizedVariationIds = Array.isArray(data.variationGroupIds)
    ? data.variationGroupIds.map((id: unknown) => {
        const numericId = Number(id)
        return Number.isFinite(numericId) ? numericId : String(id)
      })
    : []

  const normalizedStockByVariation = data.stockByVariation
    ? Object.fromEntries(
        Object.entries(data.stockByVariation as Record<string, number | string>).map(([key, value]) => [
          key.toString(),
          Number(value) || 0,
        ]),
      )
    : undefined

  const normalizedMinStockByVariation = data.minStockByVariation
    ? Object.fromEntries(
        Object.entries(data.minStockByVariation as Record<string, number | string>).map(([key, value]) => [
          key.toString(),
          Number(value) || 0,
        ]),
      )
    : undefined

  return {
    ...data,
    id: Number(data.id),
    name: String(data.name ?? ''),
    image: (data.image ?? null) as string | null,
    barcode: String(data.barcode ?? ''),
    stock: Number(data.stock ?? 0),
    price: Number(data.price ?? 0),
    tva: Number.isFinite(Number(data.tva)) ? Number(data.tva) : 20,
    variationGroupIds: normalizedVariationIds,
    stockByVariation: normalizedStockByVariation,
    minStockByVariation: normalizedMinStockByVariation,
    minStock: Number(data.minStock ?? 0),
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
