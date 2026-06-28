import { db } from '~/server/database/connection'
import { sales } from '~/server/database/schema'
import { and, eq } from 'drizzle-orm'

/**
 * ==========================================
 * Idempotence des ventes (double-submit / rejeu offline)
 * ==========================================
 *
 * Le client génère un `clientSaleId` (UUID) par vente en cours. Si une vente
 * existe déjà pour ce (tenantId, clientSaleId), le endpoint de création la
 * retourne telle quelle (duplicate: true) au lieu d'en créer une nouvelle.
 * Filet de sécurité contre la course : index unique
 * `sales_tenant_client_sale_id_unique` (migration 0020).
 */

export interface ExistingSaleForDuplicate {
  id: number
  ticketNumber: string
  saleDate: Date
  totalTTC: string
  currentHash: string
  signature: string | null
  establishmentId: number | null
  registerId: number | null
}

/** Retourne la vente déjà enregistrée pour ce (tenantId, clientSaleId), ou undefined. */
export async function findExistingSaleByClientSaleId(
  tenantId: string,
  clientSaleId: string
): Promise<ExistingSaleForDuplicate | undefined> {
  const [existing] = await db
    .select({
      id: sales.id,
      ticketNumber: sales.ticketNumber,
      saleDate: sales.saleDate,
      totalTTC: sales.totalTTC,
      currentHash: sales.currentHash,
      signature: sales.signature,
      establishmentId: sales.establishmentId,
      registerId: sales.registerId,
    })
    .from(sales)
    .where(
      and(
        eq(sales.tenantId, tenantId),
        eq(sales.clientSaleId, clientSaleId)
      )
    )
    .limit(1)

  return existing
}

/** Réponse de rejeu : même shape que la création nominale, avec duplicate: true. */
export function buildDuplicateSaleResponse(existingSale: ExistingSaleForDuplicate) {
  return {
    success: true as const,
    duplicate: true as const,
    stockWarnings: [],
    sale: {
      id: existingSale.id,
      ticketNumber: existingSale.ticketNumber,
      saleDate: existingSale.saleDate,
      totalTTC: existingSale.totalTTC,
      hash: existingSale.currentHash,
      signature: existingSale.signature,
      establishmentId: existingSale.establishmentId,
      registerId: existingSale.registerId,
      loyalty: null,
    },
  }
}
