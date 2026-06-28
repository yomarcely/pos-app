import { db } from '~/server/database/connection'
import { products } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logEntityDeactivation } from '~/server/utils/audit'

/**
 * POST /api/products/:id/archive
 * Archive un produit (soft delete)
 */
export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, message: 'ID du produit manquant' })
    }

    const productId = parseInt(id)

    const [product] = await db
      .update(products)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, productId),
          eq(products.tenantId, tenantId)
        )
      )
      .returning()

    if (!product) {
      throw createError({ statusCode: 404, message: 'Produit non trouvé' })
    }

    logger.info({ productId, productName: product.name }, 'Produit archivé')

    // Q12 — Audit log (soft delete via archive)
    const auth = event.context.auth
    await logEntityDeactivation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'product',
      entityId: productId,
      snapshot: { name: product.name },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Produit archivé avec succès',
      product: { id: product.id, name: product.name },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de l\'archivage du produit')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
