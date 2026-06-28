import { db } from '~/server/database/connection'
import { suppliers } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { updateSupplierSchema } from '~/server/validators/supplier.schema'
import { validateBody } from '~/server/utils/validation'
import { logger } from '~/server/utils/logger'
import { logEntityUpdate } from '~/server/utils/audit'

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

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityUpdate({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'supplier',
      entityId: id,
      changes: { name: updated.name, contact: updated.contact, email: updated.email },
      ipAddress: getRequestIP(event) || null,
    })

    return updated
  } catch (error) {
    logger.error({ err: error }, 'Failed to update supplier')

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
