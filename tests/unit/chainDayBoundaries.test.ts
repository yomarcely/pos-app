import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Contrôles « de bord » d'une journée de caisse (bloquant n°2, 2026-11-11) :
 * raccord avec la journée précédente, et comparaison avec ce que la clôture a
 * mémorisé. Deux niveaux :
 * 1. evaluateDayBoundaries — fonction pure, toutes les règles de décision ;
 * 2. loadDayBoundaryFacts / checkDayBoundaries — forme des requêtes (base
 *    simulée) : chaque lecture est bornée au tenant ET à la caisse.
 *
 * La base simulée ne prouve pas que le SQL est juste : c'est le rôle du passage
 * à blanc sur la base dev, fait à la livraison.
 */

// --- drizzle simulé : chaque opérateur devient un descripteur inspectable ---
interface Cond { type: string; args: unknown[] }
vi.mock('drizzle-orm', () => {
  const op = (type: string) => (...args: unknown[]) => ({ type, args })
  return {
    and: op('and'),
    eq: op('eq'),
    gte: op('gte'),
    lt: op('lt'),
    asc: op('asc'),
    desc: op('desc'),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', args: [strings.join('?'), ...values] }),
  }
})

vi.mock('~/server/database/schema', () => ({
  sales: {
    __t: 'sales',
    id: 'sales.id',
    tenantId: 'sales.tenantId',
    registerId: 'sales.registerId',
    saleDate: 'sales.saleDate',
    ticketNumber: 'sales.ticketNumber',
    previousHash: 'sales.previousHash',
    currentHash: 'sales.currentHash',
    status: 'sales.status',
    type: 'sales.type',
  },
  closures: {
    __t: 'closures',
    id: 'closures.id',
    tenantId: 'closures.tenantId',
    registerId: 'closures.registerId',
    closureDate: 'closures.closureDate',
    ticketCount: 'closures.ticketCount',
    cancelledCount: 'closures.cancelledCount',
    lastTicketNumber: 'closures.lastTicketNumber',
    lastTicketHash: 'closures.lastTicketHash',
  },
}))

interface RecordedQuery { table: string; where: Cond | null; orderBy: Cond | null; limit: number | null }
let queries: RecordedQuery[] = []
/** Résultats rendus dans l'ordre d'exécution des requêtes. */
let results: unknown[][] = []

vi.mock('~/server/database/connection', () => ({
  db: {
    select: () => {
      const q: RecordedQuery = { table: '?', where: null, orderBy: null, limit: null }
      const builder = {
        from(table: { __t: string }) { q.table = table.__t; return builder },
        where(cond: Cond) { q.where = cond; return builder },
        orderBy(order: Cond) { q.orderBy = order; return builder },
        limit(n: number) { q.limit = n; return builder },
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          queries.push(q)
          return Promise.resolve(results.shift() ?? []).then(resolve, reject)
        },
      }
      return builder
    },
  },
}))

import {
  evaluateDayBoundaries,
  loadDayBoundaryFacts,
  checkDayBoundaries,
  type DayBoundaryFacts,
} from '~/server/utils/chainDayBoundaries'

const H = (label: string) => label.padEnd(64, '0')

/** Journée saine de référence : 12 tickets comptés, clôture cohérente. */
function healthyFacts(overrides: Partial<DayBoundaryFacts> = {}): DayBoundaryFacts {
  return {
    firstTicket: { ticketNumber: '20260909-E01-R01-000101', previousHash: H('veille') },
    predecessor: { currentHash: H('veille') },
    closure: {
      ticketCount: 11,
      cancelledCount: 1,
      lastTicketNumber: '20260909-E01-R01-000112',
      lastTicketHash: H('dernier'),
    },
    closureLastTicket: { currentHash: H('dernier') },
    countedTickets: 12,
    ...overrides,
  }
}

// ==========================================
// 1. RÈGLES DE DÉCISION (fonction pure)
// ==========================================

describe('evaluateDayBoundaries', () => {
  it('journée saine : aucune anomalie', () => {
    expect(evaluateDayBoundaries(healthyFacts())).toEqual([])
  })

  describe('raccord avec la journée précédente', () => {
    it('signale un premier ticket dont le previousHash ne pointe pas sur le ticket précédent de la caisse', () => {
      // Scénario : les dernières ventes de la veille ont été supprimées. Le
      // premier ticket du jour pointe sur un ticket disparu ; le « précédent »
      // en base est désormais un ticket plus ancien.
      const anomalies = evaluateDayBoundaries(healthyFacts({
        predecessor: { currentHash: H('avant-les-ventes-supprimees') },
      }))

      expect(anomalies).toEqual([
        { kind: 'previous_day_link_broken', ticketNumber: '20260909-E01-R01-000101' },
      ])
    })

    it('signale un premier ticket qui annonce un précédent alors que la caisse n’a plus aucun ticket avant lui', () => {
      // Scénario : tout l'historique antérieur de la caisse a été effacé.
      const anomalies = evaluateDayBoundaries(healthyFacts({ predecessor: null }))

      expect(anomalies).toEqual([
        { kind: 'previous_day_link_broken', ticketNumber: '20260909-E01-R01-000101' },
      ])
    })

    it('signale un premier ticket sans previousHash alors qu’un ticket le précède', () => {
      const anomalies = evaluateDayBoundaries(healthyFacts({
        firstTicket: { ticketNumber: '20260909-E01-R01-000101', previousHash: null },
      }))

      expect(anomalies.map(a => a.kind)).toEqual(['previous_day_link_broken'])
    })

    it('accepte le tout premier ticket d’une caisse (previousHash nul, rien avant)', () => {
      const anomalies = evaluateDayBoundaries(healthyFacts({
        firstTicket: { ticketNumber: '20260909-E01-R01-000001', previousHash: null },
        predecessor: null,
      }))

      expect(anomalies).toEqual([])
    })
  })

  describe('comparaison avec la clôture', () => {
    it('fin de journée tronquée : dernier ticket de la clôture disparu ET nombre en baisse', () => {
      // Scénario : les 3 dernières ventes du soir supprimées après la clôture.
      const anomalies = evaluateDayBoundaries(healthyFacts({
        closureLastTicket: null,
        countedTickets: 9,
      }))

      expect(anomalies).toEqual([
        { kind: 'closure_last_ticket_missing', ticketNumber: '20260909-E01-R01-000112' },
        { kind: 'closure_count_mismatch', expected: 12, found: 9 },
      ])
    })

    it('journée entièrement effacée : plus aucun ticket, mais la clôture en annonçait', () => {
      const anomalies = evaluateDayBoundaries(healthyFacts({
        firstTicket: null,
        predecessor: null,
        closureLastTicket: null,
        countedTickets: 0,
      }))

      expect(anomalies).toEqual([
        { kind: 'closure_last_ticket_missing', ticketNumber: '20260909-E01-R01-000112' },
        { kind: 'closure_count_mismatch', expected: 12, found: 0 },
      ])
    })

    it('signale un dernier ticket présent mais dont le hash n’est plus celui de la clôture', () => {
      const anomalies = evaluateDayBoundaries(healthyFacts({
        closureLastTicket: { currentHash: H('reecrit') },
      }))

      expect(anomalies).toEqual([
        { kind: 'closure_last_ticket_altered', ticketNumber: '20260909-E01-R01-000112' },
      ])
    })

    it('signale un nombre de tickets supérieur à celui de la clôture', () => {
      const anomalies = evaluateDayBoundaries(healthyFacts({ countedTickets: 13 }))

      expect(anomalies).toEqual([{ kind: 'closure_count_mismatch', expected: 12, found: 13 }])
    })

    it('compare au TOTAL validées + annulées de la clôture, pas à chaque compteur', () => {
      // Une vente annulée après la clôture passe de « validée » à « annulée » en
      // base ; la clôture, elle, n'est pas réécrite. Le total compté reste le
      // même quelle que soit la répartition mémorisée : c'est ce qui évite une
      // fausse alerte. (Que la base compte bien validées + annulées, avoirs
      // exclus, est vérifié plus bas sur la requête de comptage.)
      for (const [ticketCount, cancelledCount] of [[12, 0], [11, 1], [10, 2], [0, 12]] as const) {
        const facts = healthyFacts({ countedTickets: 12 })
        facts.closure = { ...facts.closure!, ticketCount, cancelledCount }
        expect(evaluateDayBoundaries(facts)).toEqual([])
      }
    })

    it('clôture d’une journée vide (aucun document fiscal) : rien à comparer côté dernier ticket', () => {
      // close-day écrit alors lastTicketNumber = null et lastTicketHash = 'INITIAL'.
      const anomalies = evaluateDayBoundaries({
        firstTicket: null,
        predecessor: null,
        closure: { ticketCount: 0, cancelledCount: 0, lastTicketNumber: null, lastTicketHash: 'INITIAL' },
        closureLastTicket: null,
        countedTickets: 0,
      })

      expect(anomalies).toEqual([])
    })

    it('sans clôture : seul le raccord est contrôlé, aucun constat de clôture', () => {
      const facts = healthyFacts({ closure: null, closureLastTicket: null, countedTickets: null })
      expect(evaluateDayBoundaries(facts)).toEqual([])

      const broken = evaluateDayBoundaries({ ...facts, predecessor: { currentHash: H('autre') } })
      expect(broken.map(a => a.kind)).toEqual(['previous_day_link_broken'])
    })
  })

  it('cumule raccord cassé et écarts de clôture', () => {
    const anomalies = evaluateDayBoundaries(healthyFacts({
      predecessor: { currentHash: H('autre') },
      closureLastTicket: null,
      countedTickets: 4,
    }))

    expect(anomalies.map(a => a.kind)).toEqual([
      'previous_day_link_broken',
      'closure_last_ticket_missing',
      'closure_count_mismatch',
    ])
  })
})

// ==========================================
// 2. CHARGEMENT (forme des requêtes)
// ==========================================

describe('loadDayBoundaryFacts', () => {
  const bounds = { start: new Date('2026-09-08T22:00:00Z'), end: new Date('2026-09-09T22:00:00Z') }

  /** Aplatit un arbre and(...) en liste de conditions feuilles. */
  function leaves(cond: Cond | null): Cond[] {
    if (!cond) return []
    if (cond.type === 'and') return (cond.args as Cond[]).flatMap(leaves)
    return [cond]
  }
  const hasEq = (q: RecordedQuery, column: string, value: unknown) =>
    leaves(q.where).some(c => c.type === 'eq' && c.args[0] === column && c.args[1] === value)

  beforeEach(() => {
    queries = []
    results = []
  })

  it('assemble les faits d’une journée avec ventes et clôture', async () => {
    results = [
      [{ id: 501, ticketNumber: 'T-101', previousHash: H('veille') }], // premier ticket
      [{ currentHash: H('veille') }], // prédécesseur
      [{ ticketCount: 11, cancelledCount: 1, lastTicketNumber: 'T-112', lastTicketHash: H('dernier') }], // clôture
      [{ currentHash: H('dernier') }], // dernier ticket de la clôture
      [{ count: 12 }], // tickets comptés
    ]

    const facts = await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    expect(facts).toEqual({
      firstTicket: { ticketNumber: 'T-101', previousHash: H('veille') },
      predecessor: { currentHash: H('veille') },
      closure: { ticketCount: 11, cancelledCount: 1, lastTicketNumber: 'T-112', lastTicketHash: H('dernier') },
      closureLastTicket: { currentHash: H('dernier') },
      countedTickets: 12,
    })
    expect(queries.map(q => q.table)).toEqual(['sales', 'sales', 'closures', 'sales', 'sales'])
  })

  it('borne CHAQUE lecture au tenant et à la caisse', async () => {
    results = [
      [{ id: 501, ticketNumber: 'T-101', previousHash: null }],
      [],
      [{ ticketCount: 1, cancelledCount: 0, lastTicketNumber: 'T-101', lastTicketHash: H('x') }],
      [{ currentHash: H('x') }],
      [{ count: 1 }],
    ]

    await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    expect(queries).toHaveLength(5)
    for (const q of queries) {
      const prefix = q.table
      expect(hasEq(q, `${prefix}.tenantId`, 'tenant-1'), `tenant absent d'une lecture de ${prefix}`).toBe(true)
      expect(hasEq(q, `${prefix}.registerId`, 4), `caisse absente d'une lecture de ${prefix}`).toBe(true)
    }
  })

  it('cherche le prédécesseur par id strictement inférieur à celui du premier ticket', async () => {
    results = [[{ id: 501, ticketNumber: 'T-101', previousHash: H('v') }], [{ currentHash: H('v') }], []]

    await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    const predecessorQuery = queries[1]!
    expect(leaves(predecessorQuery.where)).toContainEqual({ type: 'lt', args: ['sales.id', 501] })
    // Le prédécesseur est cherché dans TOUT l'historique de la caisse : aucune borne de date.
    expect(leaves(predecessorQuery.where).some(c => c.args[0] === 'sales.saleDate')).toBe(false)
  })

  it('borne le premier ticket et le comptage à la fenêtre [start, end)', async () => {
    results = [
      [{ id: 501, ticketNumber: 'T-101', previousHash: null }],
      [],
      [{ ticketCount: 1, cancelledCount: 0, lastTicketNumber: null, lastTicketHash: 'INITIAL' }],
      [{ count: 1 }],
    ]

    await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    for (const q of [queries[0]!, queries[3]!]) {
      expect(leaves(q.where)).toContainEqual({ type: 'gte', args: ['sales.saleDate', bounds.start] })
      expect(leaves(q.where)).toContainEqual({ type: 'lt', args: ['sales.saleDate', bounds.end] })
    }
  })

  it('prend le PREMIER ticket de la fenêtre et le DERNIER ticket avant lui, par id', async () => {
    // Le sens des tris décide de tout : un prédécesseur cherché dans le mauvais
    // sens serait le tout premier ticket de la caisse, et le raccord sortirait
    // cassé chaque nuit pour chaque caisse.
    results = [
      [{ id: 501, ticketNumber: 'T-101', previousHash: H('v') }],
      [{ currentHash: H('v') }],
      [{ ticketCount: 1, cancelledCount: 0, lastTicketNumber: 'T-101', lastTicketHash: H('x') }],
      [{ currentHash: H('x') }],
      [{ count: 1 }],
    ]

    await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    const [first, predecessor, closure] = queries
    expect(first!.orderBy).toEqual({ type: 'asc', args: ['sales.id'] })
    expect(first!.limit).toBe(1)
    // Même règle que create.post.ts / cancel.post.ts : desc(sales.id), 1 ligne.
    expect(predecessor!.orderBy).toEqual({ type: 'desc', args: ['sales.id'] })
    expect(predecessor!.limit).toBe(1)
    // Plusieurs clôtures pour un même jour (ne devrait pas arriver) : la plus ancienne.
    expect(closure!.orderBy).toEqual({ type: 'asc', args: ['closures.id'] })
    expect(closure!.limit).toBe(1)
  })

  it('compte comme la clôture : ventes validées hors avoirs + ventes annulées', async () => {
    // Miroir de close-day.post.ts (ticketCount + cancelledCount). Si ce filtre
    // change — par exemple s'il se met à compter les avoirs — chaque journée
    // contenant un avoir sortirait en écart de nombre. Figé ici, et côté
    // clôture dans tests/api/closeDay.test.ts.
    results = [
      [{ id: 501, ticketNumber: 'T-101', previousHash: null }],
      [],
      [{ ticketCount: 2, cancelledCount: 1, lastTicketNumber: null, lastTicketHash: 'INITIAL' }],
      [{ count: 3 }],
    ]

    await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    const countQuery = queries[3]!
    const predicate = leaves(countQuery.where).find(c => c.type === 'sql')
    expect(predicate, 'filtre de comptage absent').toBeDefined()
    const [text, ...columns] = predicate!.args as [string, ...string[]]
    expect(text.replace(/\s+/g, ' ').trim()).toBe(
      "( (? = 'completed' AND ? IS DISTINCT FROM 'credit_note') OR ? = 'cancelled' )",
    )
    expect(columns).toEqual(['sales.status', 'sales.type', 'sales.status'])
  })

  it('cherche la clôture du jour métier demandé', async () => {
    results = [[], []]

    await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    const closureQuery = queries.find(q => q.table === 'closures')!
    expect(hasEq(closureQuery, 'closures.closureDate', '2026-09-09')).toBe(true)
  })

  it('sans vente ni clôture : aucun fait, et aucune lecture inutile', async () => {
    results = [[], []]

    const facts = await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    expect(facts).toEqual({
      firstTicket: null,
      predecessor: null,
      closure: null,
      closureLastTicket: null,
      countedTickets: null,
    })
    // Premier ticket + clôture seulement : pas de prédécesseur, pas de comptage.
    expect(queries.map(q => q.table)).toEqual(['sales', 'closures'])
  })

  it('journée effacée : clôture présente, plus aucun ticket', async () => {
    results = [
      [], // plus de premier ticket
      [{ ticketCount: 8, cancelledCount: 0, lastTicketNumber: 'T-108', lastTicketHash: H('d') }],
      [], // dernier ticket introuvable
      [{ count: 0 }],
    ]

    const facts = await loadDayBoundaryFacts('tenant-1', 4, '2026-09-09', bounds)

    expect(facts.firstTicket).toBeNull()
    expect(facts.closureLastTicket).toBeNull()
    expect(facts.countedTickets).toBe(0)
    expect(evaluateDayBoundaries(facts).map(a => a.kind)).toEqual([
      'closure_last_ticket_missing',
      'closure_count_mismatch',
    ])
  })

  it('checkDayBoundaries rend les anomalies et dit si une clôture existait', async () => {
    results = [[{ id: 501, ticketNumber: 'T-101', previousHash: H('disparu') }], [{ currentHash: H('autre') }], []]

    const outcome = await checkDayBoundaries('tenant-1', 4, '2026-09-09', bounds)

    expect(outcome).toEqual({
      anomalies: [{ kind: 'previous_day_link_broken', ticketNumber: 'T-101' }],
      hasClosure: false,
    })
  })

  it('une lecture qui échoue fait échouer le contrôle (jamais « rien à signaler » par défaut)', async () => {
    results = [[{ id: 501, ticketNumber: 'T-101', previousHash: null }]]
    // 2e lecture (prédécesseur) : on simule une panne.
    const original = results.shift
    let calls = 0
    results.shift = function shift() {
      calls++
      if (calls === 2) throw new Error('connection terminated')
      return original.call(this)
    }

    await expect(checkDayBoundaries('tenant-1', 4, '2026-09-09', bounds)).rejects.toThrow('connection terminated')
  })
})
