import { db } from '~/server/database/connection'
import { suppliers } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createSupplierSchema, type CreateSupplierInput } from '~/server/validators/supplier.schema'

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

    console.log(`✅ Fournisseur créé: ${newSupplier.name} (ID: ${newSupplier.id}) par établissement ${establishmentId}`)

    return newSupplier
  }
  catch (error: any) {
    console.error('Erreur lors de la création du fournisseur:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Erreur lors de la création du fournisseur',
    })
  }
})
