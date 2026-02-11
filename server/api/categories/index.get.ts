import { db } from '~/server/database/connection'
import { categories, syncGroupEstablishments } from '~/server/database/schema'
import { eq, and, inArray, or, sql } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer toutes les catégories
 * ==========================================
 *
 * GET /api/categories
 *
 * Retourne toutes les catégories sous forme d'arborescence
 */

interface Category {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
  icon: string | null
  color: string | null
  isArchived: boolean
  children?: Category[]
}

type CategoryRow = typeof categories.$inferSelect

function buildTree(flatCategories: CategoryRow[]): Category[] {
  const categoryMap = new Map<number, Category>()
  const roots: Category[] = []

  // Créer une map de toutes les catégories
  flatCategories.forEach(cat => {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      parentId: cat.parentId,
      sortOrder: cat.sortOrder,
      icon: cat.icon,
      color: cat.color,
      isArchived: cat.isArchived,
      children: [],
    })
  })

  // Construire l'arbre
  categoryMap.forEach(cat => {
    if (cat.parentId === null) {
      roots.push(cat)
    } else {
      const parent = categoryMap.get(cat.parentId)
      if (parent) {
        parent.children!.push(cat)
      }
    }
  })

  // Trier par ordre alphabétique
  const sortCategories = (cats: Category[]) => {
    cats.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
    cats.forEach(cat => {
      if (cat.children && cat.children.length > 0) {
        sortCategories(cat.children)
      }
    })
  }

  sortCategories(roots)

  return roots
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const includeArchived = query.includeArchived === 'true'
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : undefined

    let allCategories

    // Si un établissement est spécifié
    if (establishmentId) {
      // Récupérer les groupes de sync auxquels appartient cet établissement
      const syncGroupIds = await db
        .select({ syncGroupId: syncGroupEstablishments.syncGroupId })
        .from(syncGroupEstablishments)
        .where(
          and(
            eq(syncGroupEstablishments.tenantId, tenantId),
            eq(syncGroupEstablishments.establishmentId, establishmentId)
          )
        )

      let allowedEstablishmentIds = [establishmentId]

      // Si l'établissement est dans un groupe de sync, inclure aussi les autres établissements du groupe
      if (syncGroupIds.length > 0) {
        const groupEstablishments = await db
          .select({ establishmentId: syncGroupEstablishments.establishmentId })
          .from(syncGroupEstablishments)
          .where(
            and(
              eq(syncGroupEstablishments.tenantId, tenantId),
              inArray(syncGroupEstablishments.syncGroupId, syncGroupIds.map(g => g.syncGroupId))
            )
          )

        allowedEstablishmentIds = groupEstablishments.map(e => e.establishmentId)
      }

      // Retourner les catégories créées par l'établissement OU par les établissements du même groupe
      const conditions = [
        eq(categories.tenantId, tenantId),
        or(
          inArray(categories.createdByEstablishmentId, allowedEstablishmentIds),
          // Catégories globales (créées sans établissement) visibles partout
          sql`${categories.createdByEstablishmentId} IS NULL`,
        ),
      ]
      if (!includeArchived) {
        conditions.push(eq(categories.isArchived, false))
      }
      allCategories = await db.select().from(categories).where(and(...conditions))
    } else {
      // Sans établissement, retourner toutes les catégories du tenant
      const conditions = [
        eq(categories.tenantId, tenantId),
        // Pas d'établissement : ne retourner que les catégories globales (créées sans établissement)
        sql`${categories.createdByEstablishmentId} IS NULL`,
      ]

      if (!includeArchived) {
        conditions.push(eq(categories.isArchived, false))
      }

      allCategories = await db.select().from(categories).where(and(...conditions))
    }

    // Construire l'arbre
    const tree = buildTree(allCategories)

    return {
      success: true,
      categories: tree,
      totalCount: allCategories.length,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des catégories')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
