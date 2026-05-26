import { describe, it, expect } from 'vitest'
import {
  computeMarginKpis,
  densifyHourlySeries,
  parseIdsParam,
} from '~/server/utils/revenueStats'

describe('computeMarginKpis', () => {
  it('renvoie tout à 0 / null quand aucune vente', () => {
    expect(computeMarginKpis(0, 0, 0)).toEqual({
      totalCost: 0,
      totalMargin: 0,
      marginPct: null,
      marginCoveragePct: null,
    })
  })

  it('coverage = 100% quand toutes les ventes sont snapshotées', () => {
    // CA HT total = 100, dont 100 couvert, coût snapshoté = 60 → marge 40 (40%)
    const k = computeMarginKpis(60, 100, 100)
    expect(k.totalCost).toBe(60)
    expect(k.totalMargin).toBe(40)
    expect(k.marginPct).toBe(40)
    expect(k.marginCoveragePct).toBe(100)
  })

  it('coverage = 0% quand aucune vente n\'est snapshotée (marge € = 0, marge % null)', () => {
    // CA HT total = 100, mais 0 couvert (toutes ventes pré-migration)
    const k = computeMarginKpis(0, 0, 100)
    expect(k.totalCost).toBe(0)
    expect(k.totalMargin).toBe(0)
    expect(k.marginPct).toBeNull() // pas de revenu couvert → marge % indéfinie
    expect(k.marginCoveragePct).toBe(0)
  })

  it('mix snapshoté / non snapshoté : marge % calculée sur le revenu couvert uniquement', () => {
    // CA HT total = 200, dont 80 couvert, coût snapshoté = 50 → marge 30 sur 80 = 37.5%
    // Coverage = 80 / 200 = 40%
    const k = computeMarginKpis(50, 80, 200)
    expect(k.totalCost).toBe(50)
    expect(k.totalMargin).toBe(30)
    expect(k.marginPct).toBe(37.5)
    expect(k.marginCoveragePct).toBe(40)
  })

  it('arrondit à 2 décimales', () => {
    // 33.333... / 100 = 33.33%
    const k = computeMarginKpis(66.667, 100, 150)
    expect(k.totalMargin).toBe(33.33)
    expect(k.marginPct).toBe(33.33)
    expect(k.marginCoveragePct).toBe(66.67)
  })

  it('gère marge négative (vente à perte)', () => {
    // Vendu HT = 50, acheté = 80 → perte de 30
    const k = computeMarginKpis(80, 50, 50)
    expect(k.totalMargin).toBe(-30)
    expect(k.marginPct).toBe(-60)
    expect(k.marginCoveragePct).toBe(100)
  })
})

describe('densifyHourlySeries', () => {
  it('renvoie 24 heures avec 0 quand aucune donnée', () => {
    const result = densifyHourlySeries([])
    expect(result).toHaveLength(24)
    expect(result.every(r => r.ttc === 0 && r.ticketCount === 0)).toBe(true)
    expect(result[0]?.hour).toBe(0)
    expect(result[23]?.hour).toBe(23)
  })

  it('remplit les heures présentes et laisse les autres à 0', () => {
    const result = densifyHourlySeries([
      { hour: 9, ttc: 120, ticketCount: 3 },
      { hour: 14, ttc: 450, ticketCount: 8 },
    ])
    expect(result).toHaveLength(24)
    expect(result[9]).toEqual({ hour: 9, ttc: 120, ticketCount: 3 })
    expect(result[14]).toEqual({ hour: 14, ttc: 450, ticketCount: 8 })
    expect(result[0]).toEqual({ hour: 0, ttc: 0, ticketCount: 0 })
    expect(result[12]).toEqual({ hour: 12, ttc: 0, ticketCount: 0 })
  })

  it('ignore les heures hors plage 0-23', () => {
    // SQL ne devrait jamais renvoyer ça, mais on s'assure que c'est défensif
    const result = densifyHourlySeries([
      { hour: 25, ttc: 999, ticketCount: 99 },
      { hour: 10, ttc: 50, ticketCount: 1 },
    ])
    expect(result).toHaveLength(24)
    expect(result[10]).toEqual({ hour: 10, ttc: 50, ticketCount: 1 })
    expect(result.find(r => r.ttc === 999)).toBeUndefined()
  })
})

describe('parseIdsParam', () => {
  it('renvoie null si vide ou undefined', () => {
    expect(parseIdsParam(undefined)).toBeNull()
    expect(parseIdsParam('')).toBeNull()
    expect(parseIdsParam('  ')).toBeNull()
  })

  it('parse un id unique', () => {
    expect(parseIdsParam('42')).toEqual([42])
  })

  it('parse une liste CSV', () => {
    expect(parseIdsParam('1,2,3')).toEqual([1, 2, 3])
  })

  it('ignore les entrées invalides (lettres, négatifs, zéro)', () => {
    expect(parseIdsParam('1,abc,-5,0,7')).toEqual([1, 7])
  })

  it('renvoie null si tout est invalide', () => {
    expect(parseIdsParam('abc,-1,0')).toBeNull()
  })

  it('gère les espaces autour des virgules', () => {
    expect(parseIdsParam(' 1 , 2 , 3 ')).toEqual([1, 2, 3])
  })

  it('accepte un tableau (cas multi-query identique)', () => {
    expect(parseIdsParam(['1', '2,3'])).toEqual([1, 2, 3])
  })
})
