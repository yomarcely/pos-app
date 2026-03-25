import { db } from '~/server/database/connection'
import { suppliers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { updateSupplierSchema } from '~/server/validators/supplier.schema'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const id = Number(event.context.params?.id)

    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'ID de fournisseur invalide',
      })
    }

    const validatedData = await validateBody(event, updateSupplierSchema)

    const [updated] = await db
      .update(suppliers)
      .set({
        ...validatedData,
        name: validatedData.name?.trim(),
        email: validatedData.email?.trim() || null,
        phone: validatedData.phone?.trim() || null,
        contact: validatedData.contact?.trim() || null,
        address: validatedData.address?.trim() || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(suppliers.id, id),
          eq(suppliers.tenantId, tenantId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 404,
        message: 'Fournisseur introuvable',
      })
    }

    logger.info({ supplierId: updated.id, supplierName: updated.name, tenantId }, 'Supplier updated')

    return updated
  } catch (error) {
    logger.error({ err: error }, 'Failed to update supplier')

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
