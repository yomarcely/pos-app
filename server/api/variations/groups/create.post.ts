import { db } from '~/server/database/connection'
import { variationGroups } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/**
 * ==========================================
 * API: Créer un groupe de variation
 * ==========================================
 *
 * POST /api/variations/groups/create
 *
 * Crée un nouveau groupe de variation (ex: Couleur, Taille, Matière)
 */

interface CreateGroupRequest {
  name: string
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)

    const body = await readBody<CreateGroupRequest>(event)

    if (!body.name || body.name.trim() === '') {
      throw createError({
        statusCode: 400,
        message: 'Le nom du groupe de variation est obligatoire',
      })
    }

    const [newGroup] = await db.insert(variationGroups).values({
      tenantId,
      name: body.name.trim(),
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
