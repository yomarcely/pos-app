import { db } from '~/server/database/connection'
import { sales } from '~/server/database/schema'
import { and, gte, lt } from 'drizzle-orm'
import { getBusinessDayBounds, getBusinessDayString, BUSINESS_TIMEZONE } from '~/server/utils/businessDay'
import { verifyChainForTenant } from '~/server/utils/chainVerification'
import { logChainVerification } from '~/server/utils/audit'
import { reportChainIntegrityFailure, reportChainVerificationError } from '~/server/utils/nf525Alerting'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API INTERNE : vérification planifiée des chaînes NF525 (A5)
 * ==========================================
 *
 * GET /api/internal/verify-chains
 *
 * Déclenché par Vercel Cron (cf. vercel.json) une fois par jour à 06:00
 * Europe/Paris — après la nuit, avant l'ouverture : une chaîne cassée est
 * connue avant que le commerçant n'encaisse, et bien avant un contrôle fiscal.
 *
 * AUTH : cet endpoint n'est PAS dans PUBLIC_ENDPOINTS (règle absolue n°8). Il
 * est authentifié par `CRON_SECRET`, vérifié dans server/middleware/auth.global.ts
 * (liste `CRON_ENDPOINTS`) AVANT que ce handler ne s'exécute. Corollaire : il
 * n'y a pas de contexte auth ici, donc pas de `getTenantIdFromEvent` — le
 * handler détermine lui-même son périmètre.
 *
 * PÉRIMÈTRE : le chaînage NF525 est fait par (tenantId, registerId) — c'est le
 * dernier ticket de LA CAISSE qui fournit le previousHash (cf. create.post.ts,
 * « CHAÎNAGE par registre »). On itère donc caisse par caisse : vérifier un
 * tenant multi-caisses d'un bloc mélangerait deux chaînes et produirait des
 * « hash précédent incorrect » purement fictifs — une alerte quotidienne fausse
 * est pire que pas d'alerte.
 *
 * FENÊTRE : le jour métier précédent, borné via getBusinessDayBounds
 * (Europe/Paris). Le premier ticket de la fenêtre a un previousHash pointant
 * vers la veille, hors fenêtre : verifyTicketChain ne contrôle pas le lien du
 * premier élément, il n'y a donc pas de faux positif de bord.
 */

/** Plafond de tickets vérifiés par caisse et par jour — garde-fou mémoire/durée. */
const MAX_TICKETS_PER_REGISTER = 5000

interface RegisterCheck {
  tenantId: string
  registerId: number
  ticketCount: number
  isValid: boolean
  brokenLinksCount: number
}

export default defineEventHandler(async (event) => {
  const startedAt = Date.now()

  // Jour métier précédent : on recule de 24 h depuis maintenant puis on demande
  // son jour métier. Jamais setHours/toISOString — l'ancrage Europe/Paris est
  // porté par businessDay.ts (invariant projet).
  const businessDay = getBusinessDayString(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const { start, end } = getBusinessDayBounds(businessDay)

  logger.info({ businessDay, timezone: BUSINESS_TIMEZONE }, '[cron] Vérification planifiée des chaînes NF525')

  // Tenants/caisses « actifs » = ceux qui ont encaissé ce jour-là. Il n'existe
  // pas de table `tenants` (cf. getTenantFromUser) : l'activité de la journée
  // est la seule définition disponible, et c'est aussi la seule pertinente —
  // une caisse sans vente n'a pas de chaîne à vérifier.
  const activeRegisters = await db
    .selectDistinct({ tenantId: sales.tenantId, registerId: sales.registerId })
    .from(sales)
    .where(and(gte(sales.saleDate, start), lt(sales.saleDate, end)))

  const checks: RegisterCheck[] = []
  const failures: RegisterCheck[] = []
  // Caisses dont la vérification elle-même a planté : ni saines ni cassées,
  // NON VÉRIFIÉES. Comptées à part pour que le résumé ne les passe pas sous
  // silence — le cron ne regarde que la veille, cette journée ne sera pas revue.
  const errored: Array<{ tenantId: string; registerId: number }> = []
  // `sales.registerId` est nullable (ventes historiques antérieures à la
  // caisse obligatoire). Elles n'appartiennent à aucune chaîne au sens de
  // create.post.ts : on ne peut pas les vérifier par registre. On les compte
  // pour que le trou soit visible dans le résumé plutôt que silencieux.
  let skippedWithoutRegister = 0

  for (const { tenantId, registerId } of activeRegisters) {
    if (registerId === null) {
      skippedWithoutRegister++
      logger.warn({ tenantId, businessDay }, '[cron] Ventes sans caisse : chaîne non vérifiable par registre')
      continue
    }

    // Une caisse en échec ne doit pas empêcher de vérifier les suivantes :
    // le cron est un balayage, pas une transaction.
    try {
      const outcome = await verifyChainForTenant(tenantId, {
        registerId,
        from: start,
        to: end,
        limit: MAX_TICKETS_PER_REGISTER,
      })

      const check: RegisterCheck = {
        tenantId,
        registerId,
        ticketCount: outcome.ticketCount,
        isValid: outcome.isValid,
        brokenLinksCount: outcome.brokenLinks.length,
      }
      checks.push(check)

      if (outcome.ticketCount === 0) continue

      await logChainVerification({
        tenantId,
        userId: null,
        userName: 'System (cron)',
        isValid: outcome.isValid,
        ticketCount: outcome.ticketCount,
        brokenLinksCount: outcome.brokenLinks.length,
        registerId,
        ipAddress: null,
      })

      if (!outcome.isValid) {
        failures.push(check)
        logger.error(
          { tenantId, registerId, businessDay, brokenLinks: outcome.brokenLinks.length },
          '[cron] CHAÎNE NF525 CASSÉE',
        )
        reportChainIntegrityFailure({
          tenantId,
          source: 'cron',
          registerId,
          businessDay,
          ticketCount: outcome.ticketCount,
          brokenTicketNumbers: outcome.brokenLinks.map(l => l.ticketNumber),
        })
      }
    } catch (error) {
      // Échec de la vérification elle-même (DB indisponible, ticket illisible…).
      // On continue : ne pas transformer une caisse en panne en angle mort sur
      // toutes les autres. Mais la caisse est comptée et alertée — un ticket
      // rendu illisible par une altération en base arrive ici, pas dans
      // `failures`.
      logger.error({ err: error, tenantId, registerId, businessDay }, '[cron] Échec de vérification de chaîne')
      errored.push({ tenantId, registerId })
      reportChainVerificationError({
        tenantId,
        registerId,
        businessDay,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  }

  const durationMs = Date.now() - startedAt
  const summary = {
    businessDay,
    registersChecked: checks.length,
    ticketsChecked: checks.reduce((acc, c) => acc + c.ticketCount, 0),
    registersFailed: failures.length,
    registersErrored: errored.length,
    tenantsSkippedWithoutRegister: skippedWithoutRegister,
    durationMs,
  }

  if (failures.length > 0 || errored.length > 0) {
    logger.error({ ...summary, failures, errored }, '[cron] Vérification terminée AVEC ANOMALIES')
  } else {
    logger.info(summary, '[cron] Vérification terminée — toutes les chaînes intactes')
  }

  setResponseStatus(event, 200)
  return { success: true, ...summary }
})
