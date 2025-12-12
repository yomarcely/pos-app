import { db } from '~/server/database/connection'
import { variationGroups, establishments } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { createVariationGroupSchema, type CreateVariationGroupInput } from '~/server/validators/variation.schema'
import { eq } from 'drizzle-orm'

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
    const query = getQuery(event)

    const parseEstablishmentId = (value: any) => {
      if (Array.isArray(value)) return parseEstablishmentId(value[0])
      const num = Number(value)
      return Number.isFinite(num) ? num : undefined
    }

    // Récupérer l'établissement depuis query/body/header/cookie
    const headers = event.node.req.headers || {}
    const headerCandidates = ['x-establishment-id', 'establishment-id', 'establishmentid', 'x-establishment']
    let establishmentIdFromHeader: number | undefined
    for (const key of headerCandidates) {
      if (key in headers) {
        establishmentIdFromHeader = parseEstablishmentId(headers[key])
        if (establishmentIdFromHeader) break
      }
    }
    if (!establishmentIdFromHeader) {
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase().includes('establishment')) {
          establishmentIdFromHeader = parseEstablishmentId(v)
          if (establishmentIdFromHeader) break
        }
      }
    }

    const body = await validateBody<CreateVariationGroupInput>(event, createVariationGroupSchema)
    const establishmentIdFromBody = parseEstablishmentId((body as any).establishmentId)
    const establishmentIdFromQuery = parseEstablishmentId((query as any).establishmentId)

    // Cookies
    const cookieCandidates = [
      getCookie(event, 'pos_selected_establishment'),
      getCookie(event, 'establishmentId'),
      getCookie(event, 'establishment_id'),
    ]
    const establishmentIdFromCookie = cookieCandidates
      .map(parseEstablishmentId)
      .find(id => !!id)

    let establishmentId = establishmentIdFromQuery
      ?? establishmentIdFromBody
      ?? establishmentIdFromHeader
      ?? establishmentIdFromCookie

    // Fallback si un seul établissement dans le tenant
    if (!establishmentId) {
      const estabs = await db
        .select({ id: establishments.id })
        .from(establishments)
        .where(eq(establishments.tenantId, tenantId))
        .limit(2)
      if (estabs.length === 1) {
        establishmentId = estabs[0].id
      }
    }

    if (!establishmentId) {
      throw createError({
        statusCode: 400,
        message: 'establishmentId requis pour créer un groupe de variation',
      })
    }

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
