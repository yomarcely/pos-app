import { db } from '~/server/database/connection'
import { sales, closures } from '~/server/database/schema'
import { and, eq, asc, desc, gte, lt, sql } from 'drizzle-orm'

/**
 * ==========================================
 * Contrôles « de bord » d'une journée de caisse (NF525)
 * ==========================================
 *
 * `verifyTicketChain` (server/utils/nf525.ts) vérifie l'INTÉRIEUR d'une liste
 * de tickets : chaque ticket pointe sur le précédent de la liste, et son hash
 * correspond à son contenu. Appliqué à la fenêtre d'un jour, il laisse trois
 * angles morts, tous situés aux bords de la fenêtre :
 *
 * 1. Le premier ticket du jour pointe sur la veille, hors fenêtre : ce lien
 *    n'est comparé à rien. Des ventes supprimées en fin de veille passent.
 * 2. La fin de la fenêtre n'est comparée à rien : des ventes supprimées en fin
 *    de soirée laissent une chaîne plus courte mais cohérente.
 * 3. Une journée entièrement effacée ne laisse aucun ticket à vérifier.
 *
 * Ce module ferme ces angles morts avec deux témoins qui existent déjà en base :
 * - le ticket précédent de la caisse (celui que create.post.ts a utilisé comme
 *   `previousHash` : dernier ticket de la caisse par `id`) ;
 * - la clôture du jour, qui a mémorisé le nombre de tickets et le dernier ticket.
 *
 * Lecture seule. Aucune fonction ici ne calcule ni ne modifie un hash : la
 * fonction de hash reste unique (`generateTicketHash`, invariant 7).
 *
 * ⚠️ Limites connues, non couvertes ici :
 * - la suppression des toutes dernières ventes d'une caisse AVANT que quoi que
 *   ce soit ne s'appuie dessus (ni clôture faite, ni vente suivante) ne laisse
 *   aucune trace dans la chaîne ;
 * - la clôture est elle-même une ligne effaçable : effacée avec sa journée, elle
 *   ne témoigne plus de rien.
 * Dans les deux cas il faudrait un témoin extérieur (journal d'audit, archive
 * signée).
 *
 * ⚠️ Contrat miroir : le comptage de `loadDayBoundaryFacts` reproduit celui de
 * `server/api/sales/close-day.post.ts` (`ticketCount`, `cancelledCount`,
 * `lastTicketNumber`, `lastTicketHash`). Modifier l'un sans l'autre déclenche
 * une fausse alerte chaque nuit — figé par tests/api/closeDay.test.ts.
 */

export type DayBoundaryAnomaly =
  /** Le premier ticket du jour ne pointe pas sur le ticket précédent de la caisse. */
  | { kind: 'previous_day_link_broken'; ticketNumber: string }
  /** Le dernier ticket mémorisé par la clôture n'existe plus. */
  | { kind: 'closure_last_ticket_missing'; ticketNumber: string }
  /** Il existe, mais son hash n'est plus celui que la clôture a mémorisé. */
  | { kind: 'closure_last_ticket_altered'; ticketNumber: string }
  /** Le nombre de tickets du jour n'est plus celui que la clôture a mémorisé. */
  | { kind: 'closure_count_mismatch'; expected: number; found: number }

export interface DayBoundaryFacts {
  /** Premier ticket de la fenêtre (plus petit `id`), ou `null` si la journée est vide. */
  firstTicket: { ticketNumber: string; previousHash: string | null } | null
  /** Dernier ticket de la caisse avant `firstTicket` (par `id`), ou `null` s'il n'y en a pas. */
  predecessor: { currentHash: string } | null
  /** Clôture de ce jour pour cette caisse, ou `null` si elle n'est pas (encore) faite. */
  closure: {
    ticketCount: number
    cancelledCount: number
    lastTicketNumber: string | null
    lastTicketHash: string | null
  } | null
  /** Ticket portant `closure.lastTicketNumber`, ou `null` s'il est introuvable. */
  closureLastTicket: { currentHash: string } | null
  /**
   * Tickets de la fenêtre comptés comme la clôture les compte (cf.
   * `loadDayBoundaryFacts`). `null` quand il n'y a pas de clôture : non chargé.
   */
  countedTickets: number | null
}

export interface DayBoundaryBounds {
  /** Borne basse incluse sur `saleDate`. */
  start: Date
  /** Borne haute exclue sur `saleDate`. */
  end: Date
}

/**
 * Règles de décision, sans accès base.
 *
 * Sans clôture, seul le raccord avec la veille est contrôlé : l'absence de
 * clôture n'est pas une anomalie de chaîne (oubli du soir — la caisse bloque
 * déjà toute nouvelle vente tant que la journée n'est pas clôturée).
 */
export function evaluateDayBoundaries(facts: DayBoundaryFacts): DayBoundaryAnomaly[] {
  const anomalies: DayBoundaryAnomaly[] = []

  // 1. Raccord avec la journée précédente. À la création, previousHash = hash
  //    du dernier ticket de la caisse, ou null si la caisse n'en avait aucun.
  if (facts.firstTicket) {
    const expectedPreviousHash = facts.predecessor?.currentHash ?? null
    if (facts.firstTicket.previousHash !== expectedPreviousHash) {
      anomalies.push({ kind: 'previous_day_link_broken', ticketNumber: facts.firstTicket.ticketNumber })
    }
  }

  // 2. Comparaison avec ce que la clôture a mémorisé.
  if (facts.closure) {
    // `lastTicketNumber` est null pour une clôture sans document fiscal
    // (close-day écrit alors lastTicketHash = 'INITIAL') : rien à comparer.
    if (facts.closure.lastTicketNumber) {
      if (!facts.closureLastTicket) {
        anomalies.push({ kind: 'closure_last_ticket_missing', ticketNumber: facts.closure.lastTicketNumber })
      } else if (facts.closureLastTicket.currentHash !== facts.closure.lastTicketHash) {
        anomalies.push({ kind: 'closure_last_ticket_altered', ticketNumber: facts.closure.lastTicketNumber })
      }
    }

    const expected = facts.closure.ticketCount + facts.closure.cancelledCount
    const found = facts.countedTickets ?? 0
    if (found !== expected) {
      anomalies.push({ kind: 'closure_count_mismatch', expected, found })
    }
  }

  return anomalies
}

/**
 * Charge les faits nécessaires à `evaluateDayBoundaries` pour UNE caisse et UN
 * jour métier. Chaque lecture est bornée au tenant et à la caisse.
 *
 * Requêtes légères (une ligne ou un compteur) : indépendantes du plafond de
 * tickets appliqué à la vérification de contenu.
 *
 * Lève si une lecture échoue : l'appelant doit compter la caisse comme « non
 * vérifiée », jamais comme saine.
 */
export async function loadDayBoundaryFacts(
  tenantId: string,
  registerId: number,
  businessDay: string,
  bounds: DayBoundaryBounds,
): Promise<DayBoundaryFacts> {
  const inRegister = [eq(sales.tenantId, tenantId), eq(sales.registerId, registerId)]
  const inWindow = [gte(sales.saleDate, bounds.start), lt(sales.saleDate, bounds.end)]

  // Premier ticket de la fenêtre. Ordre par `id`, comme la vérification de
  // contenu (chainVerification.ts) et comme le chaînage à la création.
  const [first] = await db
    .select({ id: sales.id, ticketNumber: sales.ticketNumber, previousHash: sales.previousHash })
    .from(sales)
    .where(and(...inRegister, ...inWindow))
    .orderBy(asc(sales.id))
    .limit(1)

  // Son prédécesseur : même règle que create.post.ts / cancel.post.ts, qui
  // prennent le dernier ticket de la caisse par `desc(sales.id)` — donc dans
  // tout l'historique de la caisse, sans borne de date.
  let predecessor: DayBoundaryFacts['predecessor'] = null
  if (first) {
    const [previous] = await db
      .select({ currentHash: sales.currentHash })
      .from(sales)
      .where(and(...inRegister, lt(sales.id, first.id)))
      .orderBy(desc(sales.id))
      .limit(1)
    predecessor = previous ? { currentHash: previous.currentHash } : null
  }

  // Clôture du jour. Une seule est attendue par caisse et par jour ; s'il y en
  // avait plusieurs, la plus ancienne fait foi (c'est elle qui a figé la journée).
  const [closure] = await db
    .select({
      ticketCount: closures.ticketCount,
      cancelledCount: closures.cancelledCount,
      lastTicketNumber: closures.lastTicketNumber,
      lastTicketHash: closures.lastTicketHash,
    })
    .from(closures)
    .where(and(
      eq(closures.tenantId, tenantId),
      eq(closures.registerId, registerId),
      eq(closures.closureDate, businessDay),
    ))
    .orderBy(asc(closures.id))
    .limit(1)

  let closureLastTicket: DayBoundaryFacts['closureLastTicket'] = null
  let countedTickets: number | null = null

  if (closure) {
    if (closure.lastTicketNumber) {
      const [last] = await db
        .select({ currentHash: sales.currentHash })
        .from(sales)
        .where(and(...inRegister, eq(sales.ticketNumber, closure.lastTicketNumber)))
        .limit(1)
      closureLastTicket = last ? { currentHash: last.currentHash } : null
    }

    // Miroir de close-day.post.ts : `ticketCount` = ventes 'completed' hors
    // avoir, `cancelledCount` = ventes 'cancelled'. On compte la réunion des
    // deux, qui ne bouge pas quand une vente d'un jour clôturé est annulée plus
    // tard (elle passe d'un groupe à l'autre). Les avoirs, eux, restent
    // 'completed' et de type 'credit_note' : jamais comptés, ni ici ni là-bas.
    const [counted] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
      .where(and(
        ...inRegister,
        ...inWindow,
        sql`(
          (${sales.status} = 'completed' AND ${sales.type} IS DISTINCT FROM 'credit_note')
          OR ${sales.status} = 'cancelled'
        )`,
      ))
    countedTickets = Number(counted?.count ?? 0)
  }

  return {
    firstTicket: first ? { ticketNumber: first.ticketNumber, previousHash: first.previousHash } : null,
    predecessor,
    closure: closure ?? null,
    closureLastTicket,
    countedTickets,
  }
}

export interface DayBoundaryOutcome {
  anomalies: DayBoundaryAnomaly[]
  /** `false` : pas de clôture pour ce jour — la comparaison de fin de journée n'a pas pu être faite. */
  hasClosure: boolean
}

/** Charge puis évalue : point d'entrée du contrôle planifié. */
export async function checkDayBoundaries(
  tenantId: string,
  registerId: number,
  businessDay: string,
  bounds: DayBoundaryBounds,
): Promise<DayBoundaryOutcome> {
  const facts = await loadDayBoundaryFacts(tenantId, registerId, businessDay, bounds)
  return { anomalies: evaluateDayBoundaries(facts), hasClosure: facts.closure !== null }
}
