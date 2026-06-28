import { db } from '~/server/database/connection'
import { variationGroups, variations, products } from '~/server/database/schema'
import { eq, and, ne, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logEntityDeactivation } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Supprimer un groupe de variation
 * ==========================================
 *
 * DELETE /api/variations/groups/:id/delete
 *
 * Suppression soft (archivage)
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de groupe invalide',
      })
    }

    // Vérifier que le groupe existe
    const [existing] = await db.select().from(variationGroups).where(
      and(
        eq(variationGroups.id, id),
        eq(variationGroups.tenantId, tenantId),
      )
    ).limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Groupe de variation introuvable',
      })
    }

    // Vérifier s'il y a des variations actives (non archivées) dans ce groupe
    const variationsInGroup = await db.select().from(variations).where(
      and(
        eq(variations.groupId, id),
        eq(variations.tenantId, tenantId),
        ne(variations.isArchived, true),
      )
    )

    if (variationsInGroup.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Impossible de supprimer un groupe contenant ${variationsInGroup.length} variation(s)`,
      })
    }

    // Bloquer si des produits actifs utilisent des variations de ce groupe
    const allVariationsInGroup = await db
      .select({ id: variations.id })
      .from(variations)
      .where(
        and(
          eq(variations.groupId, id),
          eq(variations.tenantId, tenantId),
        )
      )

    if (allVariationsInGroup.length > 0) {
      const variationIds = allVariationsInGroup.map(v => v.id)
      const [productUsingGroup] = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.tenantId, tenantId),
            sql`(${products.isArchived} = false OR ${products.isArchived} IS NULL)`,
            sql`${products.variationGroupIds} && ${JSON.stringify(variationIds)}::jsonb`
          )
        )
        .limit(1)

      if (productUsingGroup) {
        throw createError({
          statusCode: 400,
          message: 'Impossible de supprimer ce groupe car ses variations sont assignées à un ou plusieurs produits',
        })
      }
    }

    // Soft delete
    await db
      .update(variationGroups)
      .set({
        isArchived: true,
        archivedAt: new Date(),
      })
      .where(
        and(
          eq(variationGroups.id, id),
          eq(variationGroups.tenantId, tenantId),
        )
      )

    logger.info(`Groupe de variation archivé: ${existing.name}`)

    // Q12 — Audit log (soft delete)
    const auth = event.context.auth
    await logEntityDeactivation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'variation_group',
      entityId: id,
      snapshot: { name: existing.name },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Groupe de variation supprimé avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression du groupe de variation')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
