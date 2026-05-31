import { db } from '~/server/database/connection'
import {
  inventoryPreparations,
  inventoryPreparationItems,
} from '~/server/database/schema'
import { and, eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { logEntityUpdate } from '~/server/utils/audit'
import { z } from 'zod'

const lineSchema = z.object({
  id: z.number().int().positive(),
  countedStock: z.number().int(),
})

const updateSchema = z.object({
  name: z.string().max(255).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
  lines: z.array(lineSchema).optional(),
})

type UpdateBody = z.infer<typeof updateSchema>

/**
 * PUT /api/inventory-preparations/:id
 *
 * Édite une préparation en status='draft' uniquement.
 * Champs : name, comment, et countedStock de chaque ligne existante.
 * Refuse l'édition d'une préparation déjà validée.
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const idParam = getRouterParam(event, 'id')
    const id = idParam ? Number(idParam) : NaN

    if (!id || Number.isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID de préparation manquant ou invalide' })
    }

    const body = await validateBody<UpdateBody>(event, updateSchema)

    const [preparation] = await db
      .select()
      .from(inventoryPreparations)
      .where(and(eq(inventoryPreparations.id, id), eq(inventoryPreparations.tenantId, tenantId)))
      .limit(1)

    if (!preparation) {
      throw createError({ statusCode: 404, message: 'Préparation non trouvée' })
    }

    if (preparation.status !== 'draft') {
      throw createError({
        statusCode: 403,
        message: 'Impossible de modifier une préparation déjà validée',
      })
    }

    // Charger les lignes existantes pour valider les IDs envoyés
    const existing = await db
      .select()
      .from(inventoryPreparationItems)
      .where(
        and(
          eq(inventoryPreparationItems.preparationId, id),
          eq(inventoryPreparationItems.tenantId, tenantId),
        ),
      )
    const existingIds = new Set(existing.map((l) => l.id))

    await db.transaction(async (tx) => {
      // Métadonnées
      const updateData: Partial<typeof inventoryPreparations.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (body.name !== undefined) updateData.name = body.name
      if (body.comment !== undefined) updateData.comment = body.comment
      await tx
        .update(inventoryPreparations)
        .set(updateData)
        .where(eq(inventoryPreparations.id, id))

      // Lignes
      for (const line of body.lines ?? []) {
        if (!existingIds.has(line.id)) {
          throw createError({
            statusCode: 400,
            message: `Ligne #${line.id} introuvable pour cette préparation`,
          })
        }
        await tx
          .update(inventoryPreparationItems)
          .set({ countedStock: line.countedStock })
          .where(eq(inventoryPreparationItems.id, line.id))
      }
    })

    const auth = event.context.auth
    await logEntityUpdate({
      tenantId,
      userId: preparation.userId,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'inventory_preparation',
      entityId: preparation.id,
      changes: {
        name: body.name ?? preparation.name,
        comment: body.comment ?? preparation.comment,
        updatedLineCount: body.lines?.length || 0,
      },
      ipAddress: getRequestIP(event) || null,
    })

    logger.info(
      { preparationId: id, updatedLines: body.lines?.length || 0 },
      "Préparation d'inventaire mise à jour",
    )

    return { success: true, preparationId: id }
  } catch (error) {
    logger.error({ err: error }, "Erreur lors de la modification de la préparation d'inventaire")
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur'
    throw createError({ statusCode, message })
  }
})
