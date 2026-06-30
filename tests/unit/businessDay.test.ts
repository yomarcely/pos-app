import { describe, it, expect } from 'vitest'
import { getBusinessDayString, getBusinessDayBounds, BUSINESS_TIMEZONE } from '~/server/utils/businessDay'

/**
 * Ces tests verrouillent l'invariant : le « jour métier » est ancré sur
 * Europe/Paris, indépendamment du fuseau du process Node. Ils encodent donc des
 * instants UTC précis (suffixe Z) et vérifient le jour/les bornes attendus.
 */
describe('businessDay (Europe/Paris)', () => {
  it('utilise Europe/Paris par défaut', () => {
    expect(BUSINESS_TIMEZONE).toBe('Europe/Paris')
  })

  describe('getBusinessDayString', () => {
    // Heure d'été (UTC+2) : une vente à 22:36 UTC est déjà le lendemain à Paris.
    it('22:36 UTC en été → jour Paris = lendemain', () => {
      expect(getBusinessDayString(new Date('2026-06-28T22:36:00Z'))).toBe('2026-06-29')
    })

    it('21:59 UTC en été reste le même jour Paris (23:59 local)', () => {
      expect(getBusinessDayString(new Date('2026-06-28T21:59:00Z'))).toBe('2026-06-28')
    })

    // Heure d'hiver (UTC+1) : bascule à 23:00 UTC.
    it('23:30 UTC en hiver → jour Paris = lendemain', () => {
      expect(getBusinessDayString(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16')
    })

    it('22:30 UTC en hiver reste le même jour Paris (23:30 local)', () => {
      expect(getBusinessDayString(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15')
    })
  })

  describe('getBusinessDayBounds', () => {
    // Été : minuit Paris = 22:00 UTC la veille ; minuit suivant = 22:00 UTC le jour J.
    it('borne un jour d été sur les minuits locaux (UTC+2)', () => {
      const { start, end } = getBusinessDayBounds('2026-06-29')
      expect(start.toISOString()).toBe('2026-06-28T22:00:00.000Z')
      expect(end.toISOString()).toBe('2026-06-29T22:00:00.000Z')
    })

    // Hiver : minuit Paris = 23:00 UTC la veille.
    it('borne un jour d hiver sur les minuits locaux (UTC+1)', () => {
      const { start, end } = getBusinessDayBounds('2026-01-15')
      expect(start.toISOString()).toBe('2026-01-14T23:00:00.000Z')
      expect(end.toISOString()).toBe('2026-01-15T23:00:00.000Z')
    })

    it('intervalle semi-ouvert : la vente de 22:36 UTC appartient bien au jour métier 06-29', () => {
      const sale = new Date('2026-06-28T22:36:00Z')
      const { start, end } = getBusinessDayBounds('2026-06-29')
      expect(sale.getTime()).toBeGreaterThanOrEqual(start.getTime())
      expect(sale.getTime()).toBeLessThan(end.getTime())
    })

    it('gère le débordement de mois (fin de mois → mois suivant)', () => {
      const { start, end } = getBusinessDayBounds('2026-06-30')
      expect(start.toISOString()).toBe('2026-06-29T22:00:00.000Z')
      expect(end.toISOString()).toBe('2026-06-30T22:00:00.000Z')
    })

    it('le jour de bascule heure d été (29 mars 2026) ne dure que 23h', () => {
      const { start, end } = getBusinessDayBounds('2026-03-29')
      // minuit hiver (UTC+1) → minuit été (UTC+2) : 23h d écart
      expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000)
    })
  })
})
