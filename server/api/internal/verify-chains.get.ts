import { db } from '~/server/database/connection'
import { sales, closures } from '~/server/database/schema'
import { and, eq, gte, lt } from 'drizzle-orm'
import { getBusinessDayBounds, getBusinessDayString, BUSINESS_TIMEZONE } from '~/server/utils/businessDay'
import { verifyChainForTenant } from '~/server/utils/chainVerification'
import { checkDayBoundaries, type DayBoundaryAnomaly, type DayBoundaryOutcome } from '~/server/utils/chainDayBoundaries'
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
 * (Europe/Paris).
 *
 * BORDS DE LA FENÊTRE : verifyTicketChain ne contrôle que l'intérieur de la
 * liste qu'on lui donne — ni le lien du premier ticket vers la veille, ni la
 * fin de journée. Ces bords sont contrôlés à part par checkDayBoundaries
 * (server/utils/chainDayBoundaries.ts) : raccord avec le ticket précédent de la
 * caisse, puis nombre de tickets et dernier ticket comparés à ceux que la
 * clôture a mémorisés. Sans cela, des ventes supprimées en fin de soirée ou une
 * journée entière effacée passeraient inaperçues.
 *
 * Corollaire : une caisse qui a une CLÔTURE ce jour-là est contrôlée même si
 * elle n'a plus aucune vente — c'est justement le cas de la journée effacée.
 * Et une journée clôturée EN RETARD (après le passage du cron qui la visait)
 * est reprise au passage suivant sa clôture.
 *
 * LIMITES ASSUMÉES — ce que ce contrôle ne voit pas :
 * - La clôture est elle-même une ligne effaçable : une journée effacée AVEC sa
 *   clôture, avant la vente suivante, ne laisse rien à comparer. De même pour
 *   les toutes dernières ventes supprimées avant toute clôture et toute vente
 *   suivante. Seul un témoin extérieur (journal d'audit, archive signée)
 *   trancherait.
 * - Le cron ne relit que la veille (et les journées clôturées en retard) : une
 *   altération portant sur un jour plus ancien n'est pas revue par ce passage.
 */

/** Plafond de tickets vérifiés par caisse et par jour — garde-fou mémoire/durée. */
const MAX_TICKETS_PER_REGISTER = 5000

/** Une caisse à contrôler pour un jour métier donné. */
interface DayTarget {
  tenantId: string
  /** `null` : ventes historiques sans caisse, non vérifiables par registre. */
  registerId: number | null
  day: string
}

interface RegisterCheck {
  tenantId: string
  registerId: number
  /** Jour métier contrôlé : la veille, ou un jour plus ancien clôturé en retard. */
  businessDay: string
  ticketCount: number
  isValid: boolean
  brokenLinksCount: number
  /** Constats aux bords de la journée (raccord avec la veille, écart avec la clôture). */
  boundaryAnomalies: DayBoundaryAnomaly[]
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
  // est la seule définition disponible (complétée juste après par les
  // clôtures, pour les caisses dont les ventes auraient disparu).
  const activeRegisters = await db
    .selectDistinct({ tenantId: sales.tenantId, registerId: sales.registerId })
    .from(sales)
    .where(and(gte(sales.saleDate, start), lt(sales.saleDate, end)))

  // … plus les caisses qui ont une CLÔTURE ce jour-là. Une journée dont toutes
  // les ventes ont été effacées n'apparaît plus dans la requête ci-dessus : la
  // clôture est le seul témoin qu'elle a existé. Hors du try par caisse, comme
  // la requête précédente : sans cette liste on ne sait pas quoi vérifier, le
  // cron doit échouer plutôt que répondre « rien à signaler ».
  const closedRegisters = await db
    .selectDistinct({ tenantId: closures.tenantId, registerId: closures.registerId })
    .from(closures)
    .where(eq(closures.closureDate, businessDay))

  // … plus les CLÔTURES TARDIVES : clôtures enregistrées depuis le début de la
  // veille mais portant sur un jour plus ancien. Parcours normal d'un oubli : la
  // journée du 10 est clôturée le 11 au matin (closureGuard l'impose avant toute
  // vente). Le cron du 11 a vu le 10 « sans clôture » et n'a donc rien pu
  // comparer ; sans cette reprise, le 10 ne serait plus jamais confronté à sa
  // clôture. Les fenêtres de deux passages se recouvrent de quelques heures : une
  // clôture tardive peut être contrôlée deux fois, sans conséquence.
  const lateClosures = await db
    .selectDistinct({
      tenantId: closures.tenantId,
      registerId: closures.registerId,
      closureDate: closures.closureDate,
    })
    .from(closures)
    .where(and(gte(closures.createdAt, start), lt(closures.closureDate, businessDay)))

  const targets: DayTarget[] = []
  const alreadyListed = new Set<string>()
  const addTarget = (target: DayTarget) => {
    const key = `${target.tenantId}:${target.registerId}:${target.day}`
    if (alreadyListed.has(key)) return
    alreadyListed.add(key)
    targets.push(target)
  }
  for (const r of activeRegisters) addTarget({ tenantId: r.tenantId, registerId: r.registerId, day: businessDay })
  for (const r of closedRegisters) addTarget({ tenantId: r.tenantId, registerId: r.registerId, day: businessDay })
  for (const r of lateClosures) addTarget({ tenantId: r.tenantId, registerId: r.registerId, day: r.closureDate })

  const checks: RegisterCheck[] = []
  const failures: RegisterCheck[] = []
  // Caisses dont la vérification elle-même a planté : ni saines ni cassées,
  // NON VÉRIFIÉES. Comptées à part pour que le résumé ne les passe pas sous
  // silence — le cron ne regarde que la veille, cette journée ne sera pas revue.
  const errored: Array<{ tenantId: string; registerId: number; businessDay: string }> = []
  // `sales.registerId` est nullable (ventes historiques antérieures à la
  // caisse obligatoire). Elles n'appartiennent à aucune chaîne au sens de
  // create.post.ts : on ne peut pas les vérifier par registre. On les compte
  // pour que le trou soit visible dans le résumé plutôt que silencieux.
  let skippedWithoutRegister = 0
  // Caisses ayant encaissé mais sans clôture au moment du passage : la
  // comparaison de fin de journée n'a pas pu être faite (seul le raccord avec
  // la veille l'a été). Pas une alerte — la caisse bloque déjà toute vente tant
  // que la journée n'est pas clôturée — et la journée sera reprise au passage
  // suivant sa clôture (cf. clôtures tardives ci-dessus).
  let registersWithoutClosure = 0

  /**
   * Consigne le résultat d'une caisse pour un jour : compteur, ligne d'audit,
   * et alerte si la chaîne est cassée.
   */
  const record = async (check: RegisterCheck, brokenTicketNumbers: string[]) => {
    checks.push(check)

    // Rien à journaliser pour une caisse sans ticket ET sans anomalie. Une
    // caisse sans ticket AVEC anomalie est une journée effacée : elle doit
    // laisser une trace d'audit et partir en alerte.
    if (check.ticketCount === 0 && check.isValid) return

    await logChainVerification({
      tenantId: check.tenantId,
      userId: null,
      userName: 'System (cron)',
      isValid: check.isValid,
      ticketCount: check.ticketCount,
      brokenLinksCount: check.brokenLinksCount,
      registerId: check.registerId,
      ipAddress: null,
      // La piste d'audit est le seul enregistrement durable (Sentry et les logs
      // ont une conservation limitée) : elle porte le jour et la nature du constat.
      businessDay: check.businessDay,
      boundaryAnomalies: check.boundaryAnomalies.map(a => a.kind),
    })

    if (!check.isValid) {
      failures.push(check)
      logger.error(
        {
          tenantId: check.tenantId,
          registerId: check.registerId,
          businessDay: check.businessDay,
          brokenLinks: check.brokenLinksCount,
          boundaryAnomalies: check.boundaryAnomalies,
        },
        '[cron] CHAÎNE NF525 CASSÉE',
      )
      // Un seul event par caisse et par jour, tickets cassés et constats de
      // bord réunis : un second event dans la minute serait étouffé.
      reportChainIntegrityFailure({
        tenantId: check.tenantId,
        source: 'cron',
        registerId: check.registerId,
        businessDay: check.businessDay,
        ticketCount: check.ticketCount,
        brokenTicketNumbers,
        boundaryAnomalies: check.boundaryAnomalies,
      })
    }
  }

  for (const { tenantId, registerId, day } of targets) {
    if (registerId === null) {
      skippedWithoutRegister++
      logger.warn({ tenantId, businessDay: day }, '[cron] Ventes sans caisse : chaîne non vérifiable par registre')
      continue
    }

    // Une caisse en échec ne doit pas empêcher de vérifier les suivantes :
    // le cron est un balayage, pas une transaction.
    try {
      const bounds = day === businessDay ? { start, end } : getBusinessDayBounds(day)

      const outcome = await verifyChainForTenant(tenantId, {
        registerId,
        from: bounds.start,
        to: bounds.end,
        limit: MAX_TICKETS_PER_REGISTER,
      })
      const brokenTicketNumbers = outcome.brokenLinks.map(l => l.ticketNumber)

      // Bords de la journée : raccord avec la veille + comparaison à la clôture.
      let boundaries: DayBoundaryOutcome
      try {
        boundaries = await checkDayBoundaries(tenantId, registerId, day, bounds)
      } catch (boundaryError) {
        // Le contrôle de bord a planté APRÈS une vérification de contenu
        // aboutie. Une rupture de contenu déjà établie ne doit pas être
        // rétrogradée en simple « vérification impossible » : on la consigne
        // (audit + alerte avec les numéros de ticket), puis on laisse l'erreur
        // remonter pour que la caisse soit AUSSI comptée comme non vérifiée.
        if (!outcome.isValid) {
          await record({
            tenantId,
            registerId,
            businessDay: day,
            ticketCount: outcome.ticketCount,
            isValid: false,
            brokenLinksCount: outcome.brokenLinks.length,
            boundaryAnomalies: [],
          }, brokenTicketNumbers)
        }
        throw boundaryError
      }

      if (outcome.ticketCount > 0 && !boundaries.hasClosure) registersWithoutClosure++

      await record({
        tenantId,
        registerId,
        businessDay: day,
        ticketCount: outcome.ticketCount,
        isValid: outcome.isValid && boundaries.anomalies.length === 0,
        brokenLinksCount: outcome.brokenLinks.length,
        boundaryAnomalies: boundaries.anomalies,
      }, brokenTicketNumbers)
    } catch (error) {
      // Échec de la vérification elle-même (DB indisponible, ticket illisible…).
      // On continue : ne pas transformer une caisse en panne en angle mort sur
      // toutes les autres. Mais la caisse est comptée et alertée — un ticket
      // rendu illisible par une altération en base arrive ici, pas dans
      // `failures`.
      logger.error({ err: error, tenantId, registerId, businessDay: day }, '[cron] Échec de vérification de chaîne')
      errored.push({ tenantId, registerId, businessDay: day })
      reportChainVerificationError({
        tenantId,
        registerId,
        businessDay: day,
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
    registersWithoutClosure,
    // Journées plus anciennes reprises parce que leur clôture vient d'être faite.
    lateClosuresChecked: targets.filter(t => t.day !== businessDay).length,
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
