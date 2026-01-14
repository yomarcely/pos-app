import { db } from '~/server/database/connection'
import { registers, establishments } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer toutes les caisses
 * ==========================================
 *
 * GET /api/registers?establishmentId=123 (optionnel)
 *
 * Retourne la liste de toutes les caisses actives pour le tenant
 * Peut être filtré par établissement
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const establishmentId = query.establishmentId ? Number(query.establishmentId) : null

    let conditions = [
      eq(registers.tenantId, tenantId),
      eq(registers.isActive, true),
    ]

    if (establishmentId && !isNaN(establishmentId)) {
      conditions.push(eq(registers.establishmentId, establishmentId))
    }

    // Récupérer toutes les caisses actives avec leurs établissements
    const allRegisters = await db
      .select({
        id: registers.id,
        tenantId: registers.tenantId,
        establishmentId: registers.establishmentId,
        name: registers.name,
        isActive: registers.isActive,
        createdAt: registers.createdAt,
        updatedAt: registers.updatedAt,
        establishment: {
          id: establishments.id,
          name: establishments.name,
          city: establishments.city,
        },
      })
      .from(registers)
      .leftJoin(establishments, eq(registers.establishmentId, establishments.id))
      .where(and(...conditions))
      .orderBy(registers.name)

    return {
      success: true,
      registers: allRegisters,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des caisses')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
