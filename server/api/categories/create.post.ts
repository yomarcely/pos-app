import { db } from '~/server/database/connection'
import { categories, establishments } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { createCategorySchema, type CreateCategoryInput } from '~/server/validators/category.schema'
import { validateBody } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

/**
 * ==========================================
 * API: Créer une catégorie
 * ==========================================
 *
 * POST /api/categories/create
 *
 * Crée une nouvelle catégorie ou sous-catégorie
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)

    const parseEstablishmentId = (value: any) => {
      if (Array.isArray(value)) {
        return parseEstablishmentId(value[0])
      }
      const num = Number(value)
      return Number.isFinite(num) ? num : undefined
    }

    // Essayer de récupérer depuis différents headers possibles (front sélection)
    const headers = event.node.req.headers || {}
    const headerCandidates = ['x-establishment-id', 'establishment-id', 'establishmentid', 'x-establishment']
    let establishmentIdFromHeader: number | undefined
    for (const key of headerCandidates) {
      if (key in headers) {
        establishmentIdFromHeader = parseEstablishmentId(headers[key])
        if (establishmentIdFromHeader) break
      }
    }
    // Fallback: chercher tout header contenant "establishment"
    if (!establishmentIdFromHeader) {
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase().includes('establishment')) {
          establishmentIdFromHeader = parseEstablishmentId(v)
          if (establishmentIdFromHeader) break
        }
      }
    }

    // Validation avec Zod
    const validatedData = await validateBody<CreateCategoryInput>(event, createCategorySchema)
    const establishmentIdFromBody = parseEstablishmentId((validatedData as any).establishmentId)
    const establishmentIdFromQuery = parseEstablishmentId((query as any).establishmentId)

    // Chercher d'autres clés de query contenant "establish"
    let establishmentIdFromQueryAlt: number | undefined
    for (const [key, val] of Object.entries(query || {})) {
      if (key.toLowerCase().includes('establish')) {
        establishmentIdFromQueryAlt = parseEstablishmentId(val)
        if (establishmentIdFromQueryAlt) break
      }
    }

    // Cookies (si le front stocke la sélection en cookie)
    const cookieCandidates = [
      getCookie(event, 'pos_selected_establishment'),
      getCookie(event, 'establishmentId'),
      getCookie(event, 'establishment_id'),
    ]
    const establishmentIdFromCookie = cookieCandidates
      .map(parseEstablishmentId)
      .find(id => !!id)

    let establishmentId = establishmentIdFromQuery
      ?? establishmentIdFromQueryAlt
      ?? establishmentIdFromBody
      ?? establishmentIdFromHeader
      ?? establishmentIdFromCookie

    console.log('📦 Catégorie - establishmentId sources', {
      establishmentIdFromQuery,
      establishmentIdFromQueryAlt,
      establishmentIdFromBody,
      establishmentIdFromHeader,
      establishmentIdFromCookie,
      chosen: establishmentId,
    })

    // Si aucun ID fourni, et qu'il n'y a qu'un seul établissement pour le tenant, l'utiliser par défaut
    if (!establishmentId) {
      const estabs = await db
        .select({ id: establishments.id })
        .from(establishments)
        .where(eq(establishments.tenantId, tenantId))
        .limit(2)

      if (estabs.length === 1) {
        establishmentId = estabs[0].id
        console.log(`ℹ️ Aucune establishmentId fournie, utilisation du seul établissement ${establishmentId}`)
      }
    }

    if (!establishmentId) {
      throw createError({
        statusCode: 400,
        message: 'establishmentId requis pour créer une catégorie',
      })
    }

    const { establishmentId: _, ...categoryData } = validatedData as any

    const [newCategory] = await db.insert(categories).values({
      tenantId,
      createdByEstablishmentId: establishmentId,
      ...categoryData,
    }).returning()

    console.log(`✅ Catégorie créée: ${newCategory.name} (ID: ${newCategory.id}) par établissement ${establishmentId}`)

    return {
      success: true,
      message: 'Catégorie créée avec succès',
      category: newCategory,
    }
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
