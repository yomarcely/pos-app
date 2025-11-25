import { describe, it, expect } from 'vitest'
import { validateVariationPayload } from '@/server/utils/validateVariationPayload'

describe('validateVariationPayload', () => {
  it('ignore les contrôles variations quand hasVariations est faux', () => {
    const result = validateVariationPayload({
      hasVariations: false,
      variationGroupIds: [1, 2],
      stockByVariation: { '1': 5 },
      minStockByVariation: { '1': 1 },
    })

    expect(result).toEqual({
      variationGroupIds: null,
      stockByVariation: null,
      minStockByVariation: null,
    })
  })

  it('accepte un payload variation valide', () => {
    const result = validateVariationPayload({
      hasVariations: true,
      variationGroupIds: [1, 2],
      stockByVariation: { '1': 10, '2': 0 },
      minStockByVariation: { '1': 1, '2': 2 },
    })

    expect(result).toEqual({
      variationGroupIds: [1, 2],
      stockByVariation: { '1': 10, '2': 0 },
      minStockByVariation: { '1': 1, '2': 2 },
    })
  })

  it('rejette un payload variation incomplet', () => {
    try {
      validateVariationPayload({
        hasVariations: true,
      })
    } catch (error: any) {
      expect(error.statusCode).toBe(400)
      expect(error.data?.errors).toContain("variationGroupIds doit être un tableau non vide d'identifiants numériques")
      expect(error.data?.errors).toContain('stockByVariation doit être un objet non vide contenant les variations déclarées')
      expect(error.data?.errors).toContain('minStockByVariation doit être un objet non vide contenant les variations déclarées')
      return
    }

    throw new Error('Une erreur 400 était attendue pour un payload incomplet')
  })

  it('rejette les clés incohérentes ou valeurs non numériques', () => {
    try {
      validateVariationPayload({
        hasVariations: true,
        variationGroupIds: [1, 2],
        stockByVariation: { '2': '3', '99': 1 },
        minStockByVariation: { '1': 'abc' },
      })
    } catch (error: any) {
      expect(error.statusCode).toBe(400)
      expect(error.data?.errors).toContain('stockByVariation contient une clé inattendue (99)')
      expect(error.data?.errors).toContain('stockByVariation doit contenir une entrée pour la variation 1')
      expect(error.data?.errors).toContain('minStockByVariation.1 doit être un nombre valide')
      return
    }

    throw new Error('Une erreur 400 était attendue pour des clés incohérentes')
  })
})
