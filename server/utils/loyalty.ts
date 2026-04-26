import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { customerEstablishments, loyaltyConfig } from '~/server/database/schema'
import { getSyncGroupsForEstablishment } from '~/server/utils/sync'

/**
 * ==========================================
 * Helpers — Programme de fidélité
 * ==========================================
 *
 * Source de vérité :
 * - `loyaltyConfig` (par tenant) : règles de calcul + avantage
 * - `customerEstablishments.localLoyaltyPoints` : compteur par établissement
 * - `syncRules.syncLoyaltyProgram` : si true, points cumulés cross-établissement
 *   à la LECTURE (write reste local pour éviter la désynchro)
 */

export type PointMode = 'per_euro' | 'per_ticket'
export type RewardType = 'percent_discount' | 'euro_discount' | 'voucher'

export interface LoyaltyConfigData {
  enabled: boolean
  pointMode: PointMode
  thresholdPoints: number
  rewardType: RewardType
  rewardValue: number
  voucherValidityDays: number
}

/**
 * Charge la config fidélité du tenant. Retourne null si absente OU disabled.
 * Utiliser ce helper pour court-circuiter rapidement les flux non concernés.
 */
export async function getActiveLoyaltyConfig(tenantId: string): Promise<LoyaltyConfigData | null> {
  const [row] = await db
    .select()
    .from(loyaltyConfig)
    .where(eq(loyaltyConfig.tenantId, tenantId))
    .limit(1)

  if (!row || !row.enabled) return null

  return {
    enabled: row.enabled,
    pointMode: row.pointMode as PointMode,
    thresholdPoints: row.thresholdPoints,
    rewardType: row.rewardType as RewardType,
    rewardValue: parseFloat(row.rewardValue),
    voucherValidityDays: row.voucherValidityDays,
  }
}

/**
 * Calcule le nombre de points gagnés sur une vente selon la méthode configurée.
 * - `per_euro` : 1 point par € TTC, arrondi inférieur (15.80 € → 15 pts)
 * - `per_ticket` : 1 point par ticket validé
 *
 * Renvoie 0 si totalTTC ≤ 0 (échange ou remboursement — pas d'attribution).
 */
export function calculatePointsForSale(totalTTC: number, pointMode: PointMode): number {
  if (totalTTC <= 0) return 0
  if (pointMode === 'per_ticket') return 1
  // per_euro
  return Math.floor(totalTTC)
}

/**
 * Établissements pertinents pour la lecture cumulée des points.
 * - Si syncLoyaltyProgram=true sur au moins un groupe : retourne tous les établ. du/des groupes
 * - Sinon : uniquement l'établissement courant
 *
 * Le calcul à la lecture (vs propagation à l'écriture) garantit zéro désynchro.
 */
export async function getLoyaltyScopeEstablishmentIds(
  tenantId: string,
  establishmentId: number,
): Promise<number[]> {
  const groups = await getSyncGroupsForEstablishment(tenantId, establishmentId)

  const cumulating = groups.filter(g => g.customerRules?.syncLoyaltyProgram === true)
  if (cumulating.length === 0) {
    return [establishmentId]
  }

  const ids = new Set<number>([establishmentId])
  for (const group of cumulating) {
    for (const id of group.targetEstablishments) ids.add(id)
  }
  return Array.from(ids)
}

/**
 * Lit le total de points fidélité d'un client, en cumulant cross-établissement
 * si syncLoyaltyProgram est activé pour le groupe de l'établissement courant.
 */
export async function getCustomerLoyaltyPoints(
  tenantId: string,
  customerId: number,
  establishmentId: number,
): Promise<number> {
  const scopeIds = await getLoyaltyScopeEstablishmentIds(tenantId, establishmentId)

  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${customerEstablishments.localLoyaltyPoints}), 0)`,
    })
    .from(customerEstablishments)
    .where(
      and(
        eq(customerEstablishments.tenantId, tenantId),
        eq(customerEstablishments.customerId, customerId),
        inArray(customerEstablishments.establishmentId, scopeIds),
      ),
    )

  return Number(row?.total ?? 0)
}
