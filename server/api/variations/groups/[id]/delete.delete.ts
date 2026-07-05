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
        message: `Ce groupe contient encore ${variationsInGroup.length} variation(s). Supprimez-les d'abord pour pouvoir supprimer le groupe.`,
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
      // ⚠️ variationGroupIds est une colonne JSONB (tableau d'IDs, éléments
      // numériques) : l'opérateur d'overlap `&&` n'existe pas pour jsonb
      // (l'utiliser lève une erreur Postgres → 500). On teste l'intersection
      // via jsonb_array_elements_text, en comparaison TEXTE (pas de cast ::int,
      // robuste aux éléments non numériques legacy).
      // ⚠️ ANY(${tableau}) est aussi un piège : drizzle lie un tableau JS comme
      // une LISTE de paramètres ($2,$3,$4), pas comme un array Postgres → il
      // faut construire ANY(ARRAY[...]::text[]) explicitement (validé en base).
      const variationIdsAsText = allVariationsInGroup.map(v => String(v.id))
      const idParams = sql.join(variationIdsAsText.map(v => sql`${v}`), sql`, `)
      const [productUsingGroup] = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.tenantId, tenantId),
            sql`(${products.isArchived} = false OR ${products.isArchived} IS NULL)`,
            sql`EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(${products.variationGroupIds}) = 'array'
                     THEN ${products.variationGroupIds}
                     ELSE '[]'::jsonb END
              ) AS elem(val)
              WHERE elem.val = ANY(ARRAY[${idParams}]::text[])
            )`
          )
        )
        .limit(1)

      if (productUsingGroup) {
        throw createError({
          statusCode: 400,
          message: 'Impossible de supprimer ce groupe : ses variations sont encore assignées à un ou plusieurs produits. Retirez-les de ces produits (ou archivez les produits) avant de supprimer le groupe.',
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
