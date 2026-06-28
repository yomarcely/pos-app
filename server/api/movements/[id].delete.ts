import { db } from '~/server/database/connection'
import {
  movements,
  stockMovements,
  productStocks,
} from '~/server/database/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logEntityDeletion } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Supprimer un mouvement de stock (parent + lignes) et restaurer le stock
 * ==========================================
 *
 * DELETE /api/movements/:id
 *
 * Pour chaque ligne du mouvement :
 *   - productStocks (établissement) → soustrait la quantité du delta enregistré
 *     (source de vérité ; establishmentId du mouvement requis)
 *
 * Le mouvement parent est ensuite supprimé. Les lignes stockMovements
 * partent en cascade (FK onDelete: cascade).
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const idParam = getRouterParam(event, 'id')
    const id = idParam ? Number(idParam) : NaN

    if (!id || Number.isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID du mouvement manquant ou invalide' })
    }

    // 1. Lire le mouvement et ses lignes
    const [movement] = await db
      .select()
      .from(movements)
      .where(and(eq(movements.id, id), eq(movements.tenantId, tenantId)))
      .limit(1)

    if (!movement) {
      throw createError({ statusCode: 404, message: 'Mouvement non trouvé' })
    }

    const lines = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.movementId, id),
          eq(stockMovements.tenantId, tenantId),
        ),
      )

    // Garde-fou : un mouvement parent ne devrait jamais référencer une vente,
    // mais on vérifie au cas où une ligne porte un saleId/sale reason.
    const hasSaleLine = lines.some(
      (l) => l.reason === 'sale' || l.reason === 'sale_cancellation' || l.saleId !== null,
    )
    if (hasSaleLine) {
      throw createError({
        statusCode: 403,
        message: 'Impossible de supprimer un mouvement contenant des lignes de vente',
      })
    }

    // Le stock vit dans productStocks (par établissement) : restaurer le stock des
    // lignes nécessite l'établissement du mouvement. Un mouvement sans ligne (aucun
    // stock à restaurer) reste supprimable même sans établissement.
    if (lines.length > 0 && !movement.establishmentId) {
      throw createError({
        statusCode: 400,
        message: 'Mouvement sans établissement : restauration du stock impossible',
      })
    }
    const establishmentId = movement.establishmentId!

    // 2. Transaction : revert stock pour chaque ligne, puis delete parent
    const reverts: Array<{
      productId: number
      variation: string | null
      quantity: number
      productStockReverted: boolean
    }> = []

    await db.transaction(async (tx) => {
      for (const line of lines) {
        // Revert productStocks de l'établissement du mouvement (source de vérité)
        const [stockRecord] = await tx
          .select()
          .from(productStocks)
          .where(
            and(
              eq(productStocks.productId, line.productId),
              eq(productStocks.establishmentId, establishmentId),
              eq(productStocks.tenantId, tenantId),
            ),
          )
          .limit(1)

        if (!stockRecord) {
          // Stock établissement introuvable (produit supprimé / jamais initialisé)
          logger.warn(
            { productId: line.productId, movementId: id },
            'Stock établissement introuvable lors du revert — ligne ignorée',
          )
          reverts.push({
            productId: line.productId,
            variation: line.variation,
            quantity: line.quantity,
            productStockReverted: false,
          })
          continue
        }

        if (line.variation) {
          type VarStock = { variationId: string; stock: number }
          const varStocks: VarStock[] = Array.isArray(stockRecord.stockByVariation)
            ? (stockRecord.stockByVariation as VarStock[])
            : []
          const old = varStocks.find((v) => v.variationId === line.variation)?.stock || 0
          const updated = varStocks.filter((v) => v.variationId !== line.variation)
          updated.push({ variationId: line.variation, stock: old - line.quantity })
          await tx
            .update(productStocks)
            .set({ stockByVariation: updated, updatedAt: new Date() })
            .where(eq(productStocks.id, stockRecord.id))
        } else {
          await tx
            .update(productStocks)
            .set({
              stock: sql`COALESCE(${productStocks.stock}, 0) - ${line.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(productStocks.id, stockRecord.id))
        }

        reverts.push({
          productId: line.productId,
          variation: line.variation,
          quantity: line.quantity,
          productStockReverted: true,
        })
      }

      // 3. Supprimer le mouvement parent (cascade sur stock_movements)
      await tx
        .delete(movements)
        .where(and(eq(movements.id, id), eq(movements.tenantId, tenantId)))
    })

    // 4. Audit log (non bloquant)
    const auth = event.context.auth
    await logEntityDeletion({
      tenantId,
      userId: movement.userId,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'movement',
      entityId: movement.id,
      snapshot: {
        movementNumber: movement.movementNumber,
        type: movement.type,
        comment: movement.comment,
        supplierId: movement.supplierId,
        deliveryNoteNumber: movement.deliveryNoteNumber,
        establishmentId: movement.establishmentId,
        lineCount: lines.length,
      },
      ipAddress: getRequestIP(event) || null,
    })

    logger.info(
      { movementId: id, movementNumber: movement.movementNumber, lineCount: lines.length },
      'Mouvement supprimé et stock restauré',
    )

    return {
      success: true,
      movementId: id,
      lineCount: lines.length,
      reverts,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression du mouvement')
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500
    const message = statusCode !== 500 && error instanceof Error ? error.message : "Une erreur interne s'est produite"
    throw createError({ statusCode, message })
  }
})
