import { db } from '~/server/database/connection'
import { brands, products } from '~/server/database/schema'
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
        message: 'ID de marque invalide',
      })
    }

    const productsUsingBrand = await db
      .select({ id: products.id })
      .from(products)
      .where(and(
        eq(products.brandId, id),
        eq(products.tenantId, tenantId)
      ))
      .limit(1)

    if (productsUsingBrand.length > 0) {
      throw createError({
        statusCode: 409,
        message: 'Cette marque est utilisée par des produits et ne peut pas être supprimée',
      })
    }

    const [deleted] = await db
      .delete(brands)
      .where(
        and(
          eq(brands.id, id),
          eq(brands.tenantId, tenantId)
        )
      )
      .returning()

    if (!deleted) {
      throw createError({
        statusCode: 404,
        message: 'Marque introuvable',
      })
    }

    logger.info({ brandId: deleted.id, brandName: deleted.name, tenantId }, 'Brand deleted')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityDeletion({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'brand',
      entityId: deleted.id,
      snapshot: { name: deleted.name },
      ipAddress: getRequestIP(event) || null,
    })

    return { success: true, message: 'Marque supprimée avec succès' }
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete brand')

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
