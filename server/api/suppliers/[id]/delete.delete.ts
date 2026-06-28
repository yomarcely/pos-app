import { db } from '~/server/database/connection'
import { suppliers, products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logEntityDeletion } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de fournisseur invalide',
      })
    }

    const productsUsingSupplier = await db
      .select({ id: products.id })
      .from(products)
      .where(and(
        eq(products.supplierId, id),
        eq(products.tenantId, tenantId)
      ))
      .limit(1)

    if (productsUsingSupplier.length > 0) {
      throw createError({
        statusCode: 409,
        message: 'Ce fournisseur est utilisé par des produits et ne peut pas être supprimé',
      })
    }

    const [deleted] = await db
      .delete(suppliers)
      .where(
        and(
          eq(suppliers.id, id),
          eq(suppliers.tenantId, tenantId)
        )
      )
      .returning()

    if (!deleted) {
      throw createError({
        statusCode: 404,
        message: 'Fournisseur introuvable',
      })
    }

    logger.info({ supplierId: deleted.id, supplierName: deleted.name, tenantId }, 'Supplier deleted')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityDeletion({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'supplier',
      entityId: deleted.id,
      snapshot: { name: deleted.name },
      ipAddress: getRequestIP(event) || null,
    })

    return { success: true, message: 'Fournisseur supprimé avec succès' }
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete supplier')

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
