/**
 * Snapshot du prix d'achat au moment de la vente, pour calcul de marge historique.
 *
 * Règle de résolution (du plus prioritaire au moins prioritaire) :
 *   1. productEstablishments.purchasePriceOverride (override par établissement)
 *   2. products.purchasePrice (prix d'achat global)
 *   3. null (produit sans prix d'achat configuré)
 *
 * Les valeurs sont des strings décimales (format Drizzle decimal) ; on ne convertit
 * pas en number pour préserver la précision.
 */
export function resolvePurchasePriceAtSale(
  productId: number,
  basePrices: Map<number, string | null>,
  overridePrices: Map<number, string | null>
): string | null {
  return overridePrices.get(productId) ?? basePrices.get(productId) ?? null
}
