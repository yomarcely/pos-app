import { db } from '~/server/database/connection'
import { variations, products } from '~/server/database/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Supprimer une variation
 * ==========================================
 *
 * DELETE /api/variations/:id/delete
 *
 * Suppression soft (archivage)
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de variation invalide',
      })
    }

    // Vérifier que la variation existe
    const [existing] = await db.select().from(variations).where(
      and(
        eq(variations.id, id),
        eq(variations.tenantId, tenantId),
      )
    ).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Variation introuvable',
      })
    }

    // Bloquer si des produits actifs utilisent cette variation
    const [productUsingVariation] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          sql`(${products.isArchived} = false OR ${products.isArchived} IS NULL)`,
          sql`${products.variationGroupIds} @> ${JSON.stringify([id])}::jsonb`
        )
      )
      .limit(1)

    if (productUsingVariation) {
      throw createError({
        statusCode: 400,
        message: 'Impossible de supprimer cette variation car elle est assignée à un ou plusieurs produits',
      })
    }

    // Soft delete
    await db
      .update(variations)
      .set({
        isArchived: true,
        archivedAt: new Date(),
      })
      .where(
        and(
          eq(variations.id, id),
          eq(variations.tenantId, tenantId),
        )
      )

    logger.info(`Variation archivée: ${existing.name}`)

    return {
      success: true,
      message: 'Variation supprimée avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression de la variation')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
