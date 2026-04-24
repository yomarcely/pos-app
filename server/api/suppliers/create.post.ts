import { db } from '~/server/database/connection'
import { suppliers } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createSupplierSchema, type CreateSupplierInput } from '~/server/validators/supplier.schema'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'

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

    if (!newSupplier) {
      throw createError({ statusCode: 500, message: 'Échec de la création du fournisseur' })
    }

    logger.info({
      supplierId: newSupplier.id,
      supplierName: newSupplier.name,
      establishmentId,
      tenantId
    }, 'Supplier created')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'supplier',
      entityId: newSupplier.id,
      snapshot: { name: newSupplier.name, contact: newSupplier.contact, email: newSupplier.email },
      ipAddress: getRequestIP(event) || null,
    })

    return newSupplier
  }
  catch (error) {
    logger.error({ err: error }, 'Failed to create supplier')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Erreur lors de la création du fournisseur',
    })
  }
})
