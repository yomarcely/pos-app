import { db } from '~/server/database/connection'
import { suppliers } from '~/server/database/schema'

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    const body = await readBody(event)
    const { name, contact, email, phone, address } = body

    if (!name || !name.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le nom du fournisseur est requis',
      })
    }

    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        tenantId,
        name: name.trim(),
        contact: contact?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
      })
      .returning()

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
