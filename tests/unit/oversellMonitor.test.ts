import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  recordOversellMovements,
  _resetOversellMonitorForTests,
  WINDOW_MS,
  THRESHOLD,
} from '~/server/utils/oversellMonitor'

/**
 * A5 — compteur de survente en rafale.
 *
 * Trois propriétés à garantir : la fenêtre glisse (et se réinitialise),
 * le seuil ne se déclenche qu'une fois par fenêtre, et deux établissements
 * (ou deux tenants) ne se contaminent jamais.
 */
describe('A5 — recordOversellMovements', () => {
  beforeEach(() => {
    _resetOversellMonitorForTests()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('seuil', () => {
    it('ne signale rien tant que le seuil n’est pas dépassé', () => {
      for (let i = 0; i < THRESHOLD; i++) {
        const result = recordOversellMovements('tenant-1', 1)
        expect(result.burst).toBe(false)
        expect(result.count).toBe(i + 1)
      }
    })

    it('signale la rafale au mouvement qui dépasse le seuil', () => {
      for (let i = 0; i < THRESHOLD; i++) recordOversellMovements('tenant-1', 1)

      const result = recordOversellMovements('tenant-1', 1)
      expect(result.burst).toBe(true)
      expect(result.count).toBe(THRESHOLD + 1)
      expect(result.threshold).toBe(THRESHOLD)
      expect(result.windowMs).toBe(WINDOW_MS)
    })

    it('ne signale la rafale qu’UNE fois par fenêtre (transition, pas état)', () => {
      for (let i = 0; i < THRESHOLD + 1; i++) recordOversellMovements('tenant-1', 1)

      // Le seuil est déjà franchi : les suivants comptent mais ne re-signalent pas.
      expect(recordOversellMovements('tenant-1', 1).burst).toBe(false)
      expect(recordOversellMovements('tenant-1', 1).burst).toBe(false)
    })

    it('signale immédiatement une vente dont les lignes dépassent le seuil à elles seules', () => {
      const result = recordOversellMovements('tenant-1', 1, THRESHOLD + 3)
      expect(result.burst).toBe(true)
      expect(result.count).toBe(THRESHOLD + 3)
    })

    it('compte plusieurs lignes en survente sur une même vente', () => {
      recordOversellMovements('tenant-1', 1, 3)
      const result = recordOversellMovements('tenant-1', 1, 2)
      expect(result.count).toBe(5)
      expect(result.burst).toBe(false) // 5 = seuil, pas encore dépassé
    })
  })

  describe('fenêtre', () => {
    it('réinitialise le compteur après WINDOW_MS', () => {
      for (let i = 0; i < THRESHOLD; i++) recordOversellMovements('tenant-1', 1)

      vi.advanceTimersByTime(WINDOW_MS + 1)

      const result = recordOversellMovements('tenant-1', 1)
      expect(result.count).toBe(1)
      expect(result.burst).toBe(false)
    })

    it('ne réinitialise pas avant la fin de la fenêtre', () => {
      recordOversellMovements('tenant-1', 1, 3)

      vi.advanceTimersByTime(WINDOW_MS - 1_000)

      const result = recordOversellMovements('tenant-1', 1, 3)
      expect(result.count).toBe(6)
      expect(result.burst).toBe(true)
    })

    it('permet une nouvelle rafale dans la fenêtre suivante', () => {
      for (let i = 0; i < THRESHOLD + 1; i++) recordOversellMovements('tenant-1', 1)

      vi.advanceTimersByTime(WINDOW_MS + 1)

      for (let i = 0; i < THRESHOLD; i++) {
        expect(recordOversellMovements('tenant-1', 1).burst).toBe(false)
      }
      expect(recordOversellMovements('tenant-1', 1).burst).toBe(true)
    })
  })

  describe('isolation', () => {
    it('compte séparément deux établissements du même tenant', () => {
      for (let i = 0; i < THRESHOLD + 1; i++) recordOversellMovements('tenant-1', 1)

      const other = recordOversellMovements('tenant-1', 2)
      expect(other.count).toBe(1)
      expect(other.burst).toBe(false)
    })

    it('compte séparément deux tenants sur le même numéro d’établissement', () => {
      for (let i = 0; i < THRESHOLD + 1; i++) recordOversellMovements('tenant-1', 1)

      const other = recordOversellMovements('tenant-2', 1)
      expect(other.count).toBe(1)
      expect(other.burst).toBe(false)
    })

    it('_resetOversellMonitorForTests vide bien tous les compteurs', () => {
      recordOversellMovements('tenant-1', 1, THRESHOLD)
      _resetOversellMonitorForTests()
      expect(recordOversellMovements('tenant-1', 1).count).toBe(1)
    })
  })

  describe('garde-fou', () => {
    it('ne compte rien pour zéro ou un nombre négatif de mouvements', () => {
      recordOversellMovements('tenant-1', 1, 2)

      expect(recordOversellMovements('tenant-1', 1, 0).count).toBe(2)
      expect(recordOversellMovements('tenant-1', 1, -5).count).toBe(2)
      expect(recordOversellMovements('tenant-1', 1, 0).burst).toBe(false)
    })

    it('renvoie 0 pour un établissement jamais vu, sans créer de compteur', () => {
      const result = recordOversellMovements('tenant-1', 99, 0)
      expect(result.count).toBe(0)
      expect(result.burst).toBe(false)
    })
  })
})
