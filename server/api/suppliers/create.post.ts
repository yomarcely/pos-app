import { db } from '~/server/database/connection'
import { suppliers } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createSupplierSchema, type CreateSupplierInput } from '~/server/validators/supplier.schema'
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    const body = await validateBody<CreateSupplierInput>(event, createSupplierSchema)

    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        tenantId,
        createdByEstablishmentId: establishmentId,
        name: body.name.trim(),
        contact: body.contact?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
      })
      .returning()

    logger.info({
      supplierId: newSupplier.id,
      supplierName: newSupplier.name,
      establishmentId,
      tenantId
    }, 'Supplier created')

    return newSupplier
  }
  catch (error: any) {
    logger.error({ err: error }, 'Failed to create supplier')
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Erreur lors de la création du fournisseur',
    })
  }
})
