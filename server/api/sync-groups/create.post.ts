import { db } from '~/server/database/connection'
import { syncGroups, syncGroupEstablishments, syncRules } from '~/server/database/schema'
import { createSyncGroupSchema } from '~/server/validators/sync.schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Créer un groupe de synchronisation
 * ==========================================
 *
 * POST /api/sync-groups/create
 *
 * Crée un nouveau groupe de sync avec ses établissements et règles
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const body = await readBody(event)

    // Validation des données
    const validatedData = createSyncGroupSchema.parse(body)

    // Créer le groupe de synchronisation
    const [group] = await db
      .insert(syncGroups)
      .values({
        tenantId,
        name: validatedData.name,
        description: validatedData.description,
      })
      .returning()

    // Ajouter les établissements au groupe
    await db.insert(syncGroupEstablishments).values(
      validatedData.establishmentIds.map((establishmentId) => ({
        tenantId,
        syncGroupId: group.id,
        establishmentId,
      }))
    )

    // Créer les règles de synchronisation pour les produits
    if (validatedData.productRules || validatedData.establishmentIds.length > 0) {
      await db.insert(syncRules).values({
        tenantId,
        syncGroupId: group.id,
        entityType: 'product',
        ...validatedData.productRules,
      })
    }

    // Créer les règles de synchronisation pour les clients
    if (validatedData.customerRules || validatedData.establishmentIds.length > 0) {
      await db.insert(syncRules).values({
        tenantId,
        syncGroupId: group.id,
        entityType: 'customer',
        ...validatedData.customerRules,
      })
    }

    return {
      success: true,
      syncGroup: group,
      message: 'Groupe de synchronisation créé avec succès',
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la création du groupe de synchronisation')

    // Erreur de validation Zod
    if (error && typeof error === 'object' && 'issues' in error) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
        data: error,
      })
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
