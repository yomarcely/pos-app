import { db } from '~/server/database/connection'
import { pendingSales, registers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createPendingSaleSchema, type CreatePendingSaleInput } from '~/server/validators/pending-sale.schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Créer un ticket en attente
 * ==========================================
 *
 * POST /api/pending-sales/create
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const auth = event.context.auth
    const body = await validateBody<CreatePendingSaleInput>(event, createPendingSaleSchema)

    // Vérifier que la caisse appartient bien à l'établissement et au tenant
    const [register] = await db
      .select()
      .from(registers)
      .where(
        and(
          eq(registers.id, body.registerId),
          eq(registers.tenantId, tenantId),
          eq(registers.establishmentId, body.establishmentId),
        )
      )
      .limit(1)

    if (!register) {
      throw createError({
        statusCode: 404,
        message: 'Caisse introuvable pour cet établissement',
      })
    }

    const [created] = await db
      .insert(pendingSales)
      .values({
        tenantId,
        establishmentId: body.establishmentId,
        registerId: body.registerId,
        customerId: body.customerId ?? null,
        items: body.items,
        globalDiscount: body.globalDiscount.toFixed(2),
        globalDiscountType: body.globalDiscountType,
        createdByEmail: auth?.user?.email || null,
      })
      .returning()

    if (!created) {
      throw createError({ statusCode: 500, message: 'Échec de la création du ticket en attente' })
    }

    return {
      success: true,
      pendingSale: created,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la création du ticket en attente')
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
