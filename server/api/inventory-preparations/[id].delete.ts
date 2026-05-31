import { db } from '~/server/database/connection'
import { inventoryPreparations } from '~/server/database/schema'
import { and, eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'
import { logEntityDeletion } from '~/server/utils/audit'

/**
 * DELETE /api/inventory-preparations/:id
 *
 * Supprime une préparation en status='draft'. Les lignes partent en cascade
 * (FK onDelete: cascade). Aucune restauration de stock nécessaire — la
 * préparation n'a jamais modifié le stock.
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const idParam = getRouterParam(event, 'id')
    const id = idParam ? Number(idParam) : NaN

    if (!id || Number.isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID de préparation manquant ou invalide' })
    }

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
        message: 'Impossible de supprimer une préparation déjà validée',
      })
    }

    await db
      .delete(inventoryPreparations)
      .where(and(eq(inventoryPreparations.id, id), eq(inventoryPreparations.tenantId, tenantId)))

    const auth = event.context.auth
    await logEntityDeletion({
      tenantId,
      userId: preparation.userId,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'inventory_preparation',
      entityId: preparation.id,
      snapshot: {
        preparationNumber: preparation.preparationNumber,
        name: preparation.name,
        establishmentId: preparation.establishmentId,
        status: preparation.status,
      },
      ipAddress: getRequestIP(event) || null,
    })

    logger.info(
      { preparationNumber: preparation.preparationNumber },
      "Préparation d'inventaire supprimée",
    )

    return { success: true, preparationId: id }
  } catch (error) {
    logger.error({ err: error }, "Erreur lors de la suppression de la préparation d'inventaire")
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur'
    throw createError({ statusCode, message })
  }
})
