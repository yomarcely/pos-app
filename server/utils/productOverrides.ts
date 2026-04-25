/**
 * Logique d'overrides établissement pour /api/products.
 *
 * Le format DB stocke 2 sources de vérité :
 * - `products.X` : valeur globale (au tenant)
 * - `productEstablishments.XOverride` : valeur spécifique à un établissement (peut être null)
 *
 * Quand `establishmentId` est fourni dans la query, on retourne la valeur override si elle
 * existe, sinon la valeur globale. Quand `establishmentId` est absent, on retourne la valeur
 * globale et on ignore les overrides.
 *
 * Les stocks suivent une autre logique :
 * - Avec `establishmentId` → stock issu de `productStocks` (par établissement)
 * - Sans `establishmentId` → stock global de `products.stock` (legacy)
 */

const DEFAULT_TVA_PERCENT = 20
const DEFAULT_MIN_STOCK = 5

export interface ProductRow {
  id: number
  name: string
  barcode: string | null
  barcodeByVariation: unknown
  categoryId: number | null
  categoryName: string | null
  supplierId: number | null
  supplierName: string | null
  brandId: number | null
  brandName: string | null
  price: string
  purchasePrice: string | null
  tva: string | null
  stock: number | null
  minStock: number | null
  stockByVariation: unknown
  minStockByVariation: unknown
  variationGroupIds: unknown
  image: string | null
  description: string | null
  isArchived: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
  establishmentId?: number | null
  establishmentStock?: number | null
  establishmentStockByVariation?: unknown
  establishmentMinStock?: number | null
  establishmentMinStockByVariation?: unknown
  priceOverride?: string | null
  purchasePriceOverride?: string | null
  nameOverride?: string | null
  descriptionOverride?: string | null
  barcodeOverride?: string | null
  supplierIdOverride?: number | null
  categoryIdOverride?: number | null
  brandIdOverride?: number | null
  tvaOverride?: string | null
  tvaIdOverride?: number | null
  imageOverride?: string | null
  variationGroupIdsOverride?: unknown
  isAvailableLocally?: boolean | null
}

export interface FormattedProduct {
  id: number
  name: string
  description: string
  barcode: string
  barcodeByVariation?: Record<string, string>
  categoryId: number | null
  categoryName: string | null
  supplierId: number | null
  supplierName: string | null
  brandId: number | null
  brandName: string | null
  image: string | null
  tva: number
  variationGroupIds?: number[]
  price: number
  purchasePrice?: number
  priceOverride?: number
  purchasePriceOverride?: number
  stock: number
  minStock: number
  stockByVariation?: Record<string, number>
  minStockByVariation?: Record<string, number>
  isArchived: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
  establishmentId: number | null
  isAvailable: boolean
}

/**
 * Convertit `[{variationId, stock}]` (format DB array) en `{variationId: stock}` (format frontend).
 * Retourne undefined si entrée vide ou invalide.
 */
export function normalizeStockByVariation(raw: unknown): Record<string, number> | undefined {
  if (!raw) return undefined
  if (Array.isArray(raw)) {
    const result: Record<string, number> = {}
    for (const entry of raw as Array<{ variationId: string | number, stock: number }>) {
      if (entry && entry.variationId !== undefined) {
        result[String(entry.variationId)] = Number(entry.stock) || 0
      }
    }
    return Object.keys(result).length > 0 ? result : undefined
  }
  return raw as Record<string, number>
}

/**
 * Applique les overrides établissement sur une ligne brute renvoyée par la requête DB.
 * Si `establishmentId` est défini, les overrides remplacent les valeurs globales (truthy only).
 */
export function applyEstablishmentOverrides(
  row: ProductRow,
  establishmentId: number | undefined,
): FormattedProduct {
  const scoped = Boolean(establishmentId)

  return {
    id: row.id,
    name: scoped && row.nameOverride ? row.nameOverride : row.name,
    description: scoped && row.descriptionOverride
      ? row.descriptionOverride
      : (row.description || ''),
    barcode: scoped && row.barcodeOverride
      ? row.barcodeOverride
      : (row.barcode || ''),
    barcodeByVariation: row.barcodeByVariation as Record<string, string> | undefined,
    categoryId: scoped && row.categoryIdOverride ? row.categoryIdOverride : row.categoryId,
    categoryName: row.categoryName || null,
    supplierId: scoped && row.supplierIdOverride ? row.supplierIdOverride : row.supplierId,
    supplierName: row.supplierName || null,
    brandId: scoped && row.brandIdOverride ? row.brandIdOverride : row.brandId,
    brandName: row.brandName || null,
    image: scoped && row.imageOverride ? row.imageOverride : (row.image || null),
    tva: scoped && row.tvaOverride
      ? parseFloat(row.tvaOverride)
      : parseFloat(row.tva || String(DEFAULT_TVA_PERCENT)),
    variationGroupIds: scoped && row.variationGroupIdsOverride
      ? row.variationGroupIdsOverride as number[]
      : row.variationGroupIds as number[] | undefined,
    price: scoped && row.priceOverride ? parseFloat(row.priceOverride) : parseFloat(row.price),
    purchasePrice: scoped && row.purchasePriceOverride
      ? parseFloat(row.purchasePriceOverride)
      : (row.purchasePrice ? parseFloat(row.purchasePrice) : undefined),
    priceOverride: scoped && row.priceOverride ? parseFloat(row.priceOverride) : undefined,
    purchasePriceOverride: scoped && row.purchasePriceOverride
      ? parseFloat(row.purchasePriceOverride)
      : undefined,
    stock: scoped ? (row.establishmentStock ?? 0) : (row.stock || 0),
    minStock: scoped ? (row.establishmentMinStock ?? DEFAULT_MIN_STOCK) : (row.minStock ?? DEFAULT_MIN_STOCK),
    stockByVariation: scoped
      ? normalizeStockByVariation(row.establishmentStockByVariation)
      : (row.stockByVariation as Record<string, number> | undefined),
    minStockByVariation: scoped
      ? (row.establishmentMinStockByVariation as Record<string, number> | undefined)
      : (row.minStockByVariation as Record<string, number> | undefined),
    isArchived: row.isArchived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    establishmentId: establishmentId ?? row.establishmentId ?? null,
    isAvailable: scoped ? (row.isAvailableLocally ?? true) : true,
  }
}
