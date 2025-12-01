import { db } from '~/server/database/connection'
import { categories } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

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

function buildTree(flatCategories: any[]): Category[] {
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
    const query = getQuery(event)
    const includeArchived = query.includeArchived === 'true'

    // Récupérer toutes les catégories
    let allCategories
    if (includeArchived) {
      allCategories = await db.select().from(categories)
    } else {
      allCategories = await db.select().from(categories).where(eq(categories.isArchived, false))
    }

    // Construire l'arbre
    const tree = buildTree(allCategories)

    return {
      success: true,
      categories: tree,
      totalCount: allCategories.length,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
