import { db } from '~/server/database/connection'
import { archives, sales, saleItems, closures } from '~/server/database/schema'
import { and, eq, gte, lte, desc } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { generateArchiveHash } from '~/server/utils/nf525'
import { isR2Configured, uploadArchiveToR2 } from '~/server/utils/r2Storage'
import { logger } from '~/server/utils/logger'
import { validateBody } from '~/server/utils/validation'
import { createArchiveSchema, type CreateArchiveInput } from '~/server/validators/archive.schema'
import crypto from 'crypto'

/**
 * ==========================================
 * API: Créer une archive NF525
 * ==========================================
 *
 * POST /api/archives/create
 *
 * Corps de la requête:
 * {
 *   period: "2024-01" | "2024" (mois ou année)
 *   type: "monthly" | "yearly"
 *   registerId?: number (optionnel)
 * }
 *
 * Génère une archive complète des données de vente pour une période donnée.
 * Conforme NF525 : conservation 6 ans minimum.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const { period, type, registerId } = await validateBody<CreateArchiveInput>(event, createArchiveSchema)

    logger.info({ type, period, registerId }, 'Création d\'archive NF525')

    // ==========================================
    // 1. DÉTERMINER LES DATES DE DÉBUT ET FIN
    // ==========================================
    let startDate: string
    let endDate: string

    if (type === 'monthly') {
      // Format: YYYY-MM
      const [year, month] = period.split('-')
      startDate = `${year}-${month}-01`
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    } else {
      // Format: YYYY
      startDate = `${period}-01-01`
      endDate = `${period}-12-31`
    }

    logger.debug({ startDate, endDate }, 'Période d\'archive')

    // ==========================================
    // 2. RÉCUPÉRER LES CLÔTURES DE LA PÉRIODE
    // ==========================================
    const conditions = [
      eq(closures.tenantId, tenantId),
      gte(closures.closureDate, startDate),
      lte(closures.closureDate, endDate),
    ]

    if (registerId) {
      conditions.push(eq(closures.registerId, registerId))
    }

    const closuresData = await db
      .select()
      .from(closures)
      .where(and(...conditions))
      .orderBy(desc(closures.closureDate))

    logger.debug({ closuresCount: closuresData.length }, 'Clôtures trouvées')

    // ==========================================
    // 3. RÉCUPÉRER TOUTES LES VENTES DE LA PÉRIODE
    // ==========================================
    const salesConditions = [
      eq(sales.tenantId, tenantId),
      gte(sales.saleDate, new Date(`${startDate}T00:00:00Z`)),
      lte(sales.saleDate, new Date(`${endDate}T23:59:59Z`)),
    ]

    if (registerId) {
      salesConditions.push(eq(sales.registerId, registerId))
    }

    const salesData = await db
      .select()
      .from(sales)
      .where(and(...salesConditions))
      .orderBy(desc(sales.saleDate))

    logger.debug({ salesCount: salesData.length }, 'Ventes trouvées')

    // Récupérer les items pour chaque vente
    const salesWithItems = await Promise.all(
      salesData.map(async (sale) => {
        const items = await db
          .select()
          .from(saleItems)
          .where(eq(saleItems.saleId, sale.id))

        return { ...sale, items }
      })
    )

    // ==========================================
    // 4. GÉNÉRER LE CONTENU DE L'ARCHIVE (JSON)
    // ==========================================
    const archiveContent = {
      metadata: {
        tenantId,
        period,
        type,
        registerId: registerId || null,
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        version: '1.0',
        standard: 'NF525',
      },
      statistics: {
        salesCount: salesData.length,
        closuresCount: closuresData.length,
        totalSalesAmount: salesData.reduce((sum, s) => sum + Number(s.totalTTC), 0),
      },
      closures: closuresData.map(c => ({
        id: c.id,
        closureDate: c.closureDate,
        ticketCount: c.ticketCount,
        cancelledCount: c.cancelledCount,
        totalHT: c.totalHT,
        totalTVA: c.totalTVA,
        totalTTC: c.totalTTC,
        paymentMethods: c.paymentMethods,
        closureHash: c.closureHash,
        firstTicketNumber: c.firstTicketNumber,
        lastTicketNumber: c.lastTicketNumber,
        lastTicketHash: c.lastTicketHash,
        closedBy: c.closedBy,
        closedAt: c.createdAt,
      })),
      sales: salesWithItems.map(s => ({
        id: s.id,
        ticketNumber: s.ticketNumber,
        saleDate: s.saleDate,
        totalHT: s.totalHT,
        totalTVA: s.totalTVA,
        totalTTC: s.totalTTC,
        globalDiscount: s.globalDiscount,
        globalDiscountType: s.globalDiscountType,
        sellerId: s.sellerId,
        customerId: s.customerId,
        establishmentId: s.establishmentId,
        registerId: s.registerId,
        payments: s.payments,
        previousHash: s.previousHash,
        currentHash: s.currentHash,
        signature: s.signature,
        status: s.status,
        items: s.items,
      })),
    }

    const archiveContentString = JSON.stringify(archiveContent, null, 2)

    // ==========================================
    // 5. GÉNÉRER LE HASH DE L'ARCHIVE
    // ==========================================
    const archiveHash = generateArchiveHash(archiveContentString)

    // Signature de l'archive (même logique que les tickets)
    const archiveSignature = crypto
      .createHash('sha256')
      .update(`${archiveHash}::ARCHIVE_${period}`)
      .digest('hex')

    logger.debug({ archiveHash: archiveHash.substring(0, 16) }, 'Hash archive généré')

    // ==========================================
    // 6. EXPORT IMMUABLE VERS CLOUDFLARE R2
    // ==========================================
    // L'archive stockée uniquement en DB n'a pas de valeur probante (modifiable +
    // re-signable par quiconque a accès à la base). On la pousse dans le bucket R2 avec
    // son hash SHA-256 en métadonnée d'objet. Si R2 est indisponible (credentials absents
    // au runtime) ou en échec, l'archive est créée en 'pending_export' et reste
    // ré-exportable via POST /api/archives/[id]/export — le flux ne casse jamais.
    // Voir docs/runbooks/nf525-archive-export.md.
    const fileName = `archive-${period}${registerId ? `-register-${registerId}` : ''}.json`
    const storageKey = `archives/${tenantId}/${fileName}`

    let exportStatus: 'exported' | 'pending_export' = 'pending_export'
    let exportedAt: Date | null = null
    let filePath = `inline:${fileName}`

    if (isR2Configured()) {
      try {
        await uploadArchiveToR2({
          key: storageKey,
          body: archiveContentString,
          contentHash: archiveHash,
          metadata: {
            'archive-hash': archiveHash,
            'tenant-id': tenantId,
            period,
          },
        })
        exportStatus = 'exported'
        exportedAt = new Date()
        filePath = `r2:${storageKey}`
        logger.info({ storageKey }, 'Archive exportée vers R2')
      } catch (uploadError) {
        // Ne casse pas le flux : on conserve l'archive en DB pour ré-export ultérieur.
        logger.error({ err: uploadError, storageKey }, 'Export R2 échoué — archive en pending_export')
      }
    } else {
      logger.warn('R2 non configuré — archive créée en pending_export')
    }

    // ==========================================
    // 7. ENREGISTRER L'ARCHIVE EN BASE DE DONNÉES
    // ==========================================
    const periodStartDate = new Date(`${startDate}T00:00:00Z`)
    const periodEndDate = new Date(`${endDate}T23:59:59Z`)

    const [newArchive] = await db.insert(archives).values({
      tenantId,
      period,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      archiveType: type,
      registerId: registerId || null,
      salesCount: salesData.length,
      closuresCount: closuresData.length,
      totalAmount: archiveContent.statistics.totalSalesAmount.toFixed(2),
      archiveHash,
      archiveSignature,
      filePath,
      fileSize: Buffer.byteLength(archiveContentString, 'utf8'),
      exportStatus,
      storageKey: exportStatus === 'exported' ? storageKey : null,
      exportedAt,
      // Conservé en DB tant que non exporté (pour ré-export à hash identique). Sinon R2 fait foi.
      content: exportStatus === 'exported' ? null : archiveContentString,
      metadata: {
        version: '1.0',
        standard: 'NF525',
      },
    }).returning()

    if (!newArchive) {
      throw createError({ statusCode: 500, message: 'Échec de la création de l\'archive' })
    }

    logger.info({ archiveId: newArchive.id, period, salesCount: salesData.length, closuresCount: closuresData.length }, 'Archive NF525 créée')

    // ==========================================
    // 8. RETOURNER LE RÉSULTAT
    // ==========================================
    return {
      success: true,
      archive: {
        id: newArchive.id,
        period,
        type,
        salesCount: salesData.length,
        closuresCount: closuresData.length,
        totalAmount: archiveContent.statistics.totalSalesAmount,
        archiveHash,
        archiveSignature,
        fileSize: newArchive.fileSize,
        exportStatus,
        storageKey: exportStatus === 'exported' ? storageKey : null,
        createdAt: newArchive.createdAt,
      },
      // En développement, on peut retourner le contenu
      // En production, on retournerait un lien de téléchargement
      content: archiveContent,
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la création de l\'archive')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
