import { eq, and } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { taxRates } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * DELETE /api/tax-rates/:id/delete
 * Archive (soft delete) un taux de TVA
 * Note: On ne supprime jamais complètement un taux de TVA pour la conformité NF525
 */
export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event)
  const id = Number(event.context.params?.id)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID manquant',
    })
  }

  // Archiver le taux de TVA (soft delete)
  const [archivedTaxRate] = await db
    .update(taxRates)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(taxRates.id, id),
        eq(taxRates.tenantId, tenantId)
      )
    )
    .returning()

  if (!archivedTaxRate) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Taux de TVA introuvable',
    })
  }

  return { success: true, message: 'Taux de TVA archivé avec succès' }
})
