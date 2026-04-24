import { db } from '~/server/database/connection'
import { brands } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { updateBrandSchema } from '~/server/validators/brand.schema'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { logEntityUpdate } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de marque invalide',
      })
    }

    const validatedData = await validateBody(event, updateBrandSchema)

    const [updated] = await db
      .update(brands)
      .set({
        ...validatedData,
        name: validatedData.name?.trim(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(brands.id, id),
          eq(brands.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Marque introuvable',
      })
    }

    logger.info({ brandId: updated.id, brandName: updated.name, tenantId }, 'Brand updated')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityUpdate({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'brand',
      entityId: id,
      changes: { name: updated.name },
      ipAddress: getRequestIP(event) || null,
    })

    return updated
  } catch (error) {
    logger.error({ err: error }, 'Failed to update brand')

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
