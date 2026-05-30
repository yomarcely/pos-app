import { db } from '~/server/database/connection'
import {
  movements,
  stockMovements,
  products,
  productStocks,
} from '~/server/database/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { logEntityUpdate } from '~/server/utils/audit'
import { z } from 'zod'

const lineSchema = z.object({
  id: z.number().int().positive(),
  quantity: z.number().int(),
})

const updateSchema = z.object({
  comment: z.string().max(1000).nullable().optional(),
  supplierId: z.number().int().positive().nullable().optional(),
  deliveryNoteNumber: z.string().max(100).nullable().optional(),
  lines: z.array(lineSchema).min(1).optional(),
})

type UpdateBody = z.infer<typeof updateSchema>

/**
 * ==========================================
 * API: Modifier un mouvement de stock
 * ==========================================
 *
 * PUT /api/movements/:id
 *
 * Champs modifiables :
 *   - comment, supplierId, deliveryNoteNumber (uniquement si type='reception')
 *   - quantity sur chaque ligne EXISTANTE (pas d'ajout/suppression de ligne)
 *
 * Pour chaque ligne dont la quantité change : revert ancien delta + apply nouveau
 * delta dans une transaction unique. Le sens de chaque ligne (positif/négatif)
 * est préservé : on prend le signe d'origine et on applique la nouvelle valeur
 * absolue (les pertes restent négatives).
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const idParam = getRouterParam(event, 'id')
    const id = idParam ? Number(idParam) : NaN

    if (!id || Number.isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID du mouvement manquant ou invalide' })
    }

    const body = await validateBody<UpdateBody>(event, updateSchema)

    // 1. Charger le mouvement
    const [movement] = await db
      .select()
      .from(movements)
      .where(and(eq(movements.id, id), eq(movements.tenantId, tenantId)))
      .limit(1)

    if (!movement) {
      throw createError({ statusCode: 404, message: 'Mouvement non trouvé' })
    }

    // Refuse supplierId/BL si type != reception
    if (
      (body.supplierId !== undefined || body.deliveryNoteNumber !== undefined) &&
      movement.type !== 'reception'
    ) {
      throw createError({
        statusCode: 400,
        message: 'supplierId et deliveryNoteNumber ne sont éditables que pour une réception',
      })
    }

    // 2. Charger les lignes existantes
    const existingLines = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.movementId, id),
          eq(stockMovements.tenantId, tenantId),
        ),
      )

    const hasSaleLine = existingLines.some(
      (l) => l.reason === 'sale' || l.reason === 'sale_cancellation' || l.saleId !== null,
    )
    if (hasSaleLine) {
      throw createError({
        statusCode: 403,
        message: 'Impossible de modifier un mouvement contenant des lignes de vente',
      })
    }

    // 3. Préparer le mapping des lignes à modifier
    const linesByExistingId = new Map(existingLines.map((l) => [l.id, l]))
    const updatedLines = body.lines ?? []

    for (const incoming of updatedLines) {
      if (!linesByExistingId.has(incoming.id)) {
        throw createError({
          statusCode: 400,
          message: `Ligne #${incoming.id} introuvable pour ce mouvement`,
        })
      }
    }

    // 4. Transaction : revert ancien delta + apply nouveau pour chaque ligne modifiée
    const changedLines: Array<{
      id: number
      productId: number
      oldQuantity: number
      newQuantity: number
    }> = []

    await db.transaction(async (tx) => {
      for (const incoming of updatedLines) {
        const existing = linesByExistingId.get(incoming.id)!
        const oldQty = existing.quantity

        // Préserver le signe d'origine : si l'ancien delta était négatif (perte/sortie),
        // le nouveau l'est aussi.
        const sign = oldQty === 0 ? 1 : Math.sign(oldQty)
        const newQty = sign * Math.abs(incoming.quantity)
        const delta = newQty - oldQty
        if (delta === 0) continue

        // a. Revert + apply sur products.stock global
        if (existing.variation) {
          const [product] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, existing.productId), eq(products.tenantId, tenantId)))
            .limit(1)

          if (!product) {
            throw createError({
              statusCode: 404,
              message: `Produit #${existing.productId} introuvable`,
            })
          }
          const stockByVar = (product.stockByVariation as Record<string, number>) || {}
          const current = stockByVar[existing.variation] || 0
          stockByVar[existing.variation] = current + delta
          await tx
            .update(products)
            .set({ stockByVariation: stockByVar, updatedAt: new Date() })
            .where(eq(products.id, existing.productId))
        } else {
          await tx
            .update(products)
            .set({
              stock: sql`COALESCE(${products.stock}, 0) + ${delta}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, existing.productId))
        }

        // b. productStocks par établissement (si posé sur le mouvement)
        if (movement.establishmentId) {
          const [stockRecord] = await tx
            .select()
            .from(productStocks)
            .where(
              and(
                eq(productStocks.productId, existing.productId),
                eq(productStocks.establishmentId, movement.establishmentId),
                eq(productStocks.tenantId, tenantId),
              ),
            )
            .limit(1)

          if (stockRecord) {
            if (existing.variation) {
              type VarStock = { variationId: string; stock: number }
              const varStocks: VarStock[] = Array.isArray(stockRecord.stockByVariation)
                ? (stockRecord.stockByVariation as VarStock[])
                : []
              const old = varStocks.find((v) => v.variationId === existing.variation)?.stock || 0
              const updated = varStocks.filter((v) => v.variationId !== existing.variation)
              updated.push({ variationId: existing.variation, stock: old + delta })
              await tx
                .update(productStocks)
                .set({ stockByVariation: updated, updatedAt: new Date() })
                .where(eq(productStocks.id, stockRecord.id))
            } else {
              await tx
                .update(productStocks)
                .set({
                  stock: sql`COALESCE(${productStocks.stock}, 0) + ${delta}`,
                  updatedAt: new Date(),
                })
                .where(eq(productStocks.id, stockRecord.id))
            }
          }
        }

        // c. Mettre à jour la ligne stockMovements (quantity + newStock)
        await tx
          .update(stockMovements)
          .set({
            quantity: newQty,
            newStock: existing.newStock + delta,
          })
          .where(eq(stockMovements.id, existing.id))

        changedLines.push({
          id: existing.id,
          productId: existing.productId,
          oldQuantity: oldQty,
          newQuantity: newQty,
        })
      }

      // 5. Mise à jour des métadonnées
      const updateData: Partial<typeof movements.$inferInsert> = {}
      if (body.comment !== undefined) updateData.comment = body.comment
      if (body.supplierId !== undefined) updateData.supplierId = body.supplierId
      if (body.deliveryNoteNumber !== undefined) {
        updateData.deliveryNoteNumber = body.deliveryNoteNumber
      }
      if (Object.keys(updateData).length > 0) {
        await tx
          .update(movements)
          .set(updateData)
          .where(and(eq(movements.id, id), eq(movements.tenantId, tenantId)))
      }
    })

    // 6. Audit
    const auth = event.context.auth
    await logEntityUpdate({
      tenantId,
      userId: movement.userId,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'movement',
      entityId: movement.id,
      changes: {
        comment: body.comment ?? movement.comment,
        supplierId: body.supplierId ?? movement.supplierId,
        deliveryNoteNumber: body.deliveryNoteNumber ?? movement.deliveryNoteNumber,
        changedLines,
      },
      ipAddress: getRequestIP(event) || null,
    })

    logger.info(
      { movementId: id, changedLines: changedLines.length },
      'Mouvement mis à jour',
    )

    return {
      success: true,
      movementId: id,
      changedLines,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la modification du mouvement')
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur'
    throw createError({ statusCode, message })
  }
})
