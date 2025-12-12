import { db } from '~/server/database/connection'
import { variationGroups } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createVariationGroupSchema, type CreateVariationGroupInput } from '~/server/validators/variation.schema'

/**
 * ==========================================
 * API: Créer un groupe de variation
 * ==========================================
 *
 * POST /api/variations/groups/create?establishmentId=123
 *
 * Crée un nouveau groupe de variation (ex: Couleur, Taille, Matière)
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    const body = await validateBody<CreateVariationGroupInput>(event, createVariationGroupSchema)

    const [newGroup] = await db.insert(variationGroups).values({
      tenantId,
      name: body.name.trim(),
      createdByEstablishmentId: establishmentId,
    }).returning()

    console.log(`✅ Groupe de variation créé: ${newGroup.name} (ID: ${newGroup.id})`)

    return {
      success: true,
      message: 'Groupe de variation créé avec succès',
      group: newGroup,
    }
  } catch (error) {
    console.error('Erreur lors de la création du groupe de variation:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
