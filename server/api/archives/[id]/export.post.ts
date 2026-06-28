import { db } from '~/server/database/connection'
import { archives } from '~/server/database/schema'
import { and, eq } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { generateArchiveHash } from '~/server/utils/nf525'
import { isR2Configured, uploadArchiveToR2 } from '~/server/utils/r2Storage'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Ré-exporter une archive NF525 vers R2
 * ==========================================
 *
 * POST /api/archives/:id/export
 *
 * Pousse vers Cloudflare R2 une archive restée en `pending_export` (R2 indisponible ou
 * en échec lors de la création). Le contenu conservé en DB est ré-exporté tel quel : le
 * hash recalculé doit correspondre au `archiveHash` stocké, sinon l'opération est refusée
 * (détection d'altération). Idempotent : une archive déjà exportée renvoie son état.
 *
 * Voir docs/runbooks/nf525-archive-export.md.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')

    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id) || id <= 0) {
      throw createError({ statusCode: 400, message: 'Identifiant d\'archive invalide' })
    }

    const [archive] = await db
      .select()
      .from(archives)
      .where(and(eq(archives.id, id), eq(archives.tenantId, tenantId)))
      .limit(1)

    if (!archive) {
      throw createError({ statusCode: 404, message: 'Archive introuvable' })
    }

    // Déjà exportée → idempotent.
    if (archive.exportStatus === 'exported') {
      return {
        success: true,
        alreadyExported: true,
        archive: { id: archive.id, exportStatus: archive.exportStatus, storageKey: archive.storageKey },
      }
    }

    if (!isR2Configured()) {
      throw createError({
        statusCode: 503,
        message: 'R2 non configuré : impossible d\'exporter (vérifier R2_* côté serveur)',
      })
    }

    if (!archive.content) {
      throw createError({
        statusCode: 409,
        message: 'Contenu de l\'archive absent en DB : ré-export impossible',
      })
    }

    // Vérification d'intégrité : le contenu DB doit toujours produire le hash stocké.
    const recomputedHash = generateArchiveHash(archive.content)
    if (recomputedHash !== archive.archiveHash) {
      logger.error(
        { archiveId: id, stored: archive.archiveHash, recomputed: recomputedHash },
        'Hash recalculé ≠ hash stocké — archive potentiellement altérée',
      )
      throw createError({
        statusCode: 409,
        message: 'Intégrité compromise : le contenu ne correspond plus au hash stocké',
      })
    }

    const fileName = `archive-${archive.period}${archive.registerId ? `-register-${archive.registerId}` : ''}.json`
    const storageKey = `archives/${tenantId}/${fileName}`

    await uploadArchiveToR2({
      key: storageKey,
      body: archive.content,
      contentHash: archive.archiveHash,
      metadata: {
        'archive-hash': archive.archiveHash,
        'tenant-id': tenantId,
        period: archive.period,
      },
    })

    const exportedAt = new Date()
    await db
      .update(archives)
      .set({
        exportStatus: 'exported',
        storageKey,
        exportedAt,
        filePath: `r2:${storageKey}`,
        content: null, // R2 fait désormais foi — on libère la copie DB.
      })
      .where(and(eq(archives.id, id), eq(archives.tenantId, tenantId)))

    logger.info({ archiveId: id, storageKey }, 'Archive ré-exportée vers R2')

    return {
      success: true,
      alreadyExported: false,
      archive: { id, exportStatus: 'exported', storageKey, exportedAt },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors du ré-export de l\'archive')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
