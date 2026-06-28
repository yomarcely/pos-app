import { db } from '~/server/database/connection'
import { archives } from '~/server/database/schema'
import { desc, eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Récupérer la liste des archives
 * ==========================================
 *
 * GET /api/archives?registerId=1
 *
 * Retourne toutes les archives créées pour le tenant.
 * Filtrage optionnel par caisse.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const query = getQuery(event)
    const registerIdParam = query.registerId as string | undefined

    const conditions = [eq(archives.tenantId, tenantId)]

    if (registerIdParam) {
      conditions.push(eq(archives.registerId, Number(registerIdParam)))
    }

    const archivesList = await db
      .select({
        id: archives.id,
        archiveType: archives.archiveType,
        period: archives.period,
        startDate: archives.periodStart,
        endDate: archives.periodEnd,
        registerId: archives.registerId,
        salesCount: archives.salesCount,
        closuresCount: archives.closuresCount,
        totalAmount: archives.totalAmount,
        archiveHash: archives.archiveHash,
        archiveSignature: archives.archiveSignature,
        fileSize: archives.fileSize,
        filePath: archives.filePath,
        exportStatus: archives.exportStatus,
        storageKey: archives.storageKey,
        exportedAt: archives.exportedAt,
        createdAt: archives.createdAt,
      })
      .from(archives)
      .where(and(...conditions))
      .orderBy(desc(archives.createdAt))

    logger.debug({ count: archivesList.length }, 'Archives récupérées')

    return {
      success: true,
      archives: archivesList,
      count: archivesList.length,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des archives')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
