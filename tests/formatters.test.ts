import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  formatDate,
  formatDateTime,
  formatPercentage,
  formatNumber
} from '@/utils/formatters'

describe('formatters', () => {
  describe('formatPrice', () => {
    it('formate correctement un nombre', () => {
      expect(formatPrice(12.345)).toContain('12,35')
      expect(formatPrice(1000)).toContain('000')
      expect(formatPrice(0)).toContain('0,00')
    })

    it('arrondit correctement', () => {
      expect(formatPrice(12.999)).toContain('13,00')
      expect(formatPrice(12.004)).toContain('12,00')
    })

    it('gère les strings avec virgule', () => {
      expect(formatPrice('12,3')).toContain('12,30')
      expect(formatPrice('1000,50')).toContain('000,50')
    })

    it('gère les strings invalides avec fallback', () => {
      expect(formatPrice('bad', 0)).toContain('0,00')
      expect(formatPrice('bad', 10)).toContain('10,00')
      // Chaîne vide est traitée comme 0, donc utilise fallback 0
      expect(formatPrice('', 0)).toContain('0,00')
    })

    it('gère les valeurs négatives', () => {
      expect(formatPrice(-10.5)).toContain('-10,50')
    })
  })

  describe('formatDate', () => {
    it('formate une date ISO correctement', () => {
      expect(formatDate('2024-02-01')).toBe('01/02/2024')
      expect(formatDate('2024-12-25')).toBe('25/12/2024')
    })

    it('formate un objet Date', () => {
      const date = new Date('2024-06-15T10:30:00')
      expect(formatDate(date)).toBe('15/06/2024')
    })

    it('renvoie une chaîne vide pour date invalide', () => {
      expect(formatDate('not-a-date')).toBe('')
      expect(formatDate('2024-13-45')).toBe('')
      expect(formatDate('')).toBe('')
    })
  })

  describe('formatDateTime', () => {
    it('formate une date et heure correctement', () => {
      const result = formatDateTime('2024-02-01T14:30:00')
      expect(result).toContain('01/02/2024')
      expect(result).toContain('14:30')
    })

    it('formate un objet Date', () => {
      const date = new Date('2024-06-15T10:30:00')
      const result = formatDateTime(date)
      expect(result).toContain('15/06/2024')
      expect(result).toContain('10:30')
    })

    it('renvoie une chaîne vide pour date invalide', () => {
      expect(formatDateTime('not-a-date')).toBe('')
      expect(formatDateTime('')).toBe('')
    })
  })

  describe('formatPercentage', () => {
    it('formate avec décimales', () => {
      expect(formatPercentage(0.1234, 2)).toBe('12,34\u00A0%')
      expect(formatPercentage(0.5, 1)).toBe('50,0\u00A0%')
    })

    it('formate sans décimales par défaut', () => {
      expect(formatPercentage(0.25)).toBe('25\u00A0%')
      expect(formatPercentage(0.5)).toBe('50\u00A0%')
    })

    it('gère les valeurs négatives', () => {
      expect(formatPercentage(-0.1)).toContain('-10')
    })

    it('gère les valeurs supérieures à 1', () => {
      expect(formatPercentage(1.5)).toContain('150')
    })
  })

  describe('formatNumber', () => {
    it('formate avec séparateurs de milliers', () => {
      expect(formatNumber(1000)).toContain('000')
      expect(formatNumber(1234567)).toContain('234')
    })

    it('gère les petits nombres', () => {
      expect(formatNumber(0)).toBe('0')
      expect(formatNumber(42)).toBe('42')
    })

    it('gère les nombres décimaux', () => {
      expect(formatNumber(12.34)).toBe('12,34')
      expect(formatNumber(1000.5)).toContain('000,5')
    })

    it('gère les nombres négatifs', () => {
      expect(formatNumber(-1234)).toContain('-1')
      expect(formatNumber(-1234)).toContain('234')
    })
  })
})
