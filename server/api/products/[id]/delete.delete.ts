import { db } from '~/server/database/connection'
import { products, saleItems } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { logEntityDeletion } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Supprimer un produit
 * ==========================================
 *
 * DELETE /api/products/:id/delete
 *
 * Si le produit est présent dans des ventes, la suppression est refusée (409).
 * Dans ce cas, il faut archiver le produit via POST /api/products/:id/archive.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID du produit manquant',
      })
    }

    const productId = parseInt(id)

    // Vérifier si le produit existe
    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!product) {
      throw createError({
        statusCode: 404,
        message: 'Produit non trouvé',
      })
    }

    // Vérifier si le produit est présent dans des ventes
    const salesWithProduct = await db
      .select({ id: saleItems.id })
      .from(saleItems)
      .where(eq(saleItems.productId, productId))
      .limit(1)

    if (salesWithProduct.length > 0) {
      throw createError({
        statusCode: 409,
        message: 'Ce produit est présent dans des ventes et ne peut pas être supprimé. Archivez-le à la place.',
      })
    }

    // Supprimer le produit
    await db.delete(products).where(
      and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      )
    )

    logger.info({
      productId,
      productName: product.name,
    }, 'Produit supprimé')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityDeletion({
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
      message: 'Produit supprimé avec succès',
      product: {
        id: product.id,
        name: product.name,
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la suppression du produit')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
