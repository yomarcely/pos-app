import { db } from '~/server/database/connection'
import { products, stockMovements, productStocks } from '~/server/database/schema'
import { eq, and, sql } from 'drizzle-orm'
import { createMovement } from '~/server/utils/createMovement'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { z } from 'zod'

const movementItemSchema = z.object({
  productId: z.number().int().positive(),
  variation: z.string().optional(),
  quantity: z.number(),
  adjustmentType: z.enum(['add', 'set']).default('add'),
})

const createMovementSchema = z.object({
  type: z.enum(['reception', 'adjustment', 'loss', 'transfer']),
  comment: z.string().max(1000).optional(),
  items: z.array(movementItemSchema).min(1, 'Aucun article dans le mouvement'),
  // establishmentId requis : le stock vit dans productStocks (source de vérité par établissement)
  establishmentId: z.number().int().positive(),
  supplierId: z.number().int().positive().optional(),
  deliveryNoteNumber: z.string().max(100).optional(),
}).refine(
  (data) => !((data.supplierId || data.deliveryNoteNumber) && data.type !== 'reception'),
  { message: 'supplierId et deliveryNoteNumber ne sont autorisés que pour le type reception' }
)

/**
 * ==========================================
 * API: Créer un mouvement de stock groupé
 * ==========================================
 *
 * POST /api/movements/create
 *
 * Corps de la requête:
 * {
 *   type: 'reception' | 'adjustment' | 'loss' | 'transfer',
 *   comment?: string,
 *   userId?: number,
 *   items: [{
 *     productId: number,
 *     variation?: string,
 *     quantity: number,
 *     adjustmentType: 'add' | 'set'
 *   }]
 * }
 */

interface MovementItem {
  productId: number
  variation?: string
  quantity: number
  adjustmentType: 'add' | 'set'
}

interface CreateMovementRequest {
  type: 'reception' | 'adjustment' | 'loss' | 'transfer'
  comment?: string
  items: MovementItem[]
  establishmentId: number
  supplierId?: number
  deliveryNoteNumber?: string
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const auth = event.context.auth
    const userId = auth?.user?.id || null
    const body = await validateBody<CreateMovementRequest>(event, createMovementSchema)

    // Validation
    if (!body.type) {
      throw createError({
        statusCode: 400,
        message: 'Type de mouvement manquant',
      })
    }

    if (!body.items || body.items.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Aucun article dans le mouvement',
      })
    }

    // Mapper le type vers le reason pour stock_movements
    const reasonMap: Record<string, string> = {
      reception: 'reception',
      adjustment: 'inventory_adjustment',
      loss: 'loss',
      transfer: 'transfer',
    }

    const reason = reasonMap[body.type] ?? 'inventory_adjustment'

    const result = await db.transaction(async (tx) => {
      // ==========================================
      // VERROU DE CONCURRENCE (par établissement)
      // ==========================================
      // Même verrou que server/api/sales/create.post.ts : pg_advisory_xact_lock sur
      // l'establishmentId (clé numérique identique, acquis en TOUT DÉBUT de transaction,
      // AVANT toute lecture de stock). Conséquences :
      //   - oldStock est lu sous verrou → l'audit oldStock/newStock est cohérent même
      //     sous ajustements simultanés du même produit.
      //   - le mode "set" devient exact : delta = quantity - oldStock appliqué à un stock
      //     qui ne peut plus bouger entre lecture et écriture → on obtient bien la valeur
      //     absolue demandée.
      //   - le chemin variation (read-modify-write JSONB) est sérialisé → plus de lost update.
      // Pas d'interblocage avec sales/create : même clé (establishmentId) et même ordre
      // d'acquisition (verrou pris en premier, une seule clé par transaction).
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${body.establishmentId})`)

      // 1. Créer le mouvement principal — `tx` obligatoire : deadlock en mode
      // pooler max=1 sinon (voir DbExecutor dans connection.ts).
      const movement = await createMovement(body.type, body.comment, undefined, tenantId, {
        supplierId: body.supplierId ?? null,
        deliveryNoteNumber: body.deliveryNoteNumber ?? null,
        establishmentId: body.establishmentId ?? null,
      }, tx)

      // 2. Créer les lignes de stock_movements
      const stockMovementsData = []

      for (const item of body.items) {
        // Récupérer le produit
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1)

        if (!product) {
          throw createError({
            statusCode: 404,
            message: `Produit #${item.productId} non trouvé`,
          })
        }

        // Source de vérité = productStocks (par établissement, requis).
        // oldStock/newStock de l'audit sont désormais lus/écrits sur productStocks.
        let oldStock = 0
        let newStock = 0
        let quantityDelta = 0

        const [stockRecord] = await tx
          .select()
          .from(productStocks)
          .where(
            and(
              eq(productStocks.productId, item.productId),
              eq(productStocks.establishmentId, body.establishmentId),
              eq(productStocks.tenantId, tenantId)
            )
          )
          .limit(1)

        if (item.variation) {
          type VarStock = { variationId: string; stock: number }
          const varStocks: VarStock[] = stockRecord && Array.isArray(stockRecord.stockByVariation)
            ? (stockRecord.stockByVariation as VarStock[])
            : []
          // Read-modify-write du JSONB : sûr car sérialisé par le verrou établissement
          // (plus de lost update entre ajustements concurrents du même produit/variation).
          oldStock = varStocks.find(v => v.variationId === item.variation)?.stock || 0
          quantityDelta = item.adjustmentType === 'add' ? item.quantity : item.quantity - oldStock
          newStock = oldStock + quantityDelta

          const updated = varStocks.filter(v => v.variationId !== item.variation)
          updated.push({ variationId: item.variation, stock: newStock })

          if (stockRecord) {
            await tx.update(productStocks)
              .set({ stockByVariation: updated, updatedAt: new Date() })
              .where(eq(productStocks.id, stockRecord.id))
          } else {
            await tx.insert(productStocks).values({
              tenantId,
              productId: item.productId,
              establishmentId: body.establishmentId,
              stock: 0,
              stockByVariation: updated,
            })
          }
        } else {
          // oldStock lu sous verrou (voir pg_advisory_xact_lock plus haut).
          oldStock = stockRecord?.stock || 0
          quantityDelta = item.adjustmentType === 'add' ? item.quantity : item.quantity - oldStock

          if (stockRecord) {
            // Mise à jour atomique du stock établissement. On garde l'écriture atomique
            // (stock = COALESCE(stock,0) + delta) — sûre car sérialisée par le verrou — et
            // on récupère la VRAIE valeur post-UPDATE via RETURNING pour l'audit newStock,
            // au lieu de la valeur calculée en amont (qui pouvait diverger sous concurrence).
            const [updated] = await tx.update(productStocks)
              .set({
                stock: sql`COALESCE(${productStocks.stock}, 0) + ${quantityDelta}`,
                updatedAt: new Date(),
              })
              .where(eq(productStocks.id, stockRecord.id))
              .returning({ stock: productStocks.stock })
            newStock = updated?.stock ?? oldStock + quantityDelta
          } else {
            newStock = oldStock + quantityDelta
            await tx.insert(productStocks).values({
              tenantId,
              productId: item.productId,
              establishmentId: body.establishmentId,
              stock: newStock,
              stockByVariation: [],
            })
          }
        }

        // Créer la ligne de mouvement de stock
        await tx.insert(stockMovements).values({
          tenantId,
          movementId: movement.id,
          productId: item.productId,
          variation: item.variation || null,
          quantity: quantityDelta,
          oldStock,
          newStock,
          reason,
          userId: null,
        })

        stockMovementsData.push({
          productId: item.productId,
          variation: item.variation,
          oldStock,
          newStock,
          quantityDelta,
        })
      }

      return {
        movement,
        stockMovements: stockMovementsData,
      }
    })

    logger.info({
      movementNumber: result.movement.movementNumber,
      itemsCount: body.items.length,
      type: body.type
    }, 'Mouvement de stock créé')

    return {
      success: true,
      movement: result.movement,
      details: result.stockMovements,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la création du mouvement')

    const statusCode = error instanceof Error && 'statusCode' in error ? (error as { statusCode: number }).statusCode : 500
    const message = statusCode !== 500 && error instanceof Error ? error.message : "Une erreur interne s'est produite"

    throw createError({
      statusCode,
      message,
    })
  }
})
