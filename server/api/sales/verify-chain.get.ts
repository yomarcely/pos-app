import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { verifyChainForTenant } from '~/server/utils/chainVerification'
import { logChainVerification } from '~/server/utils/audit'
import { reportChainIntegrityFailure } from '~/server/utils/nf525Alerting'
import { logger } from '~/server/utils/logger'
import { z } from 'zod'

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate doit être au format YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate doit être au format YYYY-MM-DD').optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
  registerId: z.coerce.number().int().positive().optional(),
})

/**
 * ==========================================
 * API: Vérifier l'intégrité de la chaîne de tickets (Audit NF525)
 * ==========================================
 *
 * GET /api/sales/verify-chain?registerId=1&limit=100
 *
 * Vérifie que la chaîne cryptographique des tickets est intacte.
 * Permet de détecter toute altération frauduleuse des données.
 *
 * Paramètres optionnels:
 * - registerId: Vérifier uniquement une caisse spécifique
 * - limit: Nombre maximum de tickets à vérifier (défaut: 1000)
 * - startDate: Date de début (format YYYY-MM-DD)
 * - endDate: Date de fin (format YYYY-MM-DD)
 *
 * A5 — le chargement + la vérification vivent dans
 * `server/utils/chainVerification.ts`, partagés avec le contrôle planifié
 * `/api/internal/verify-chains`. Ce handler garde l'audit log, l'alerte
 * Sentry et la forme de la réponse.
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const parsed = querySchema.safeParse(getQuery(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        message: `Paramètres invalides : ${parsed.error.issues.map(i => i.message).join(' ; ')}`,
      })
    }

    const { startDate, endDate } = parsed.data
    const registerId = parsed.data.registerId ?? null
    const limit = parsed.data.limit ?? 1000

    logger.info({ tenantId, registerId }, 'Vérification de chaîne')

    const verificationResult = await verifyChainForTenant(tenantId, {
      registerId,
      startDate,
      endDate,
      limit,
    })

    if (verificationResult.ticketCount === 0) {
      return {
        success: true,
        isValid: true,
        message: 'Aucun ticket à vérifier',
        ticketCount: 0,
        brokenLinks: [],
      }
    }

    // ==========================================
    // 3. ENREGISTRER LA VÉRIFICATION DANS L'AUDIT LOG (NF525)
    // ==========================================
    await logChainVerification({
      tenantId,
      userId: null,
      userName: 'System',
      isValid: verificationResult.isValid,
      ticketCount: verificationResult.ticketCount,
      brokenLinksCount: verificationResult.brokenLinks.length,
      registerId,
      ipAddress: getRequestIP(event) || null,
    })

    // A5 — alerte proactive : une chaîne cassée est un incident de conformité,
    // pas une simple ligne d'audit. La capture ne doit jamais faire échouer la
    // vérification (reportChainIntegrityFailure avale ses propres erreurs).
    if (!verificationResult.isValid) {
      reportChainIntegrityFailure({
        tenantId,
        source: 'api',
        registerId,
        ticketCount: verificationResult.ticketCount,
        brokenTicketNumbers: verificationResult.brokenLinks.map(l => l.ticketNumber),
      })
    }

    // ==========================================
    // 4. RETOURNER LE RÉSULTAT
    // ==========================================

    logger.info(
      { isValid: verificationResult.isValid, brokenLinks: verificationResult.brokenLinks.length },
      `Vérification terminée: ${verificationResult.isValid ? 'CHAÎNE INTACTE' : `${verificationResult.brokenLinks.length} PROBLÈMES DÉTECTÉS`}`
    )

    return {
      success: true,
      isValid: verificationResult.isValid,
      ticketCount: verificationResult.ticketCount,
      brokenLinks: verificationResult.brokenLinks,
      message: verificationResult.isValid
        ? `Chaîne vérifiée avec succès (${verificationResult.ticketCount} tickets)`
        : `⚠️ ${verificationResult.brokenLinks.length} anomalie(s) détectée(s) dans la chaîne`,
      details: {
        firstTicket: verificationResult.firstTicket,
        lastTicket: verificationResult.lastTicket,
        registerId,
        tenantId,
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la vérification de chaîne')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
