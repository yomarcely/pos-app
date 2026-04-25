import { describe, it, expect } from 'vitest'
import {
  applyEstablishmentOverrides,
  normalizeStockByVariation,
  type ProductRow,
} from '~/server/utils/productOverrides'

function makeRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 1,
    name: 'Produit Global',
    barcode: '123',
    barcodeByVariation: null,
    categoryId: 10,
    categoryName: 'Cat A',
    supplierId: 20,
    supplierName: 'Fournisseur X',
    brandId: 30,
    brandName: 'Marque Y',
    price: '9.99',
    purchasePrice: '5.00',
    tva: '20',
    stock: 50,
    minStock: 10,
    stockByVariation: null,
    minStockByVariation: null,
    variationGroupIds: null,
    image: null,
    description: 'Description globale',
    isArchived: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    ...overrides,
  }
}

describe('normalizeStockByVariation', () => {
  it('retourne undefined si null/undefined', () => {
    expect(normalizeStockByVariation(null)).toBeUndefined()
    expect(normalizeStockByVariation(undefined)).toBeUndefined()
  })

  it('convertit le format array en objet', () => {
    const raw = [
      { variationId: '9', stock: 5 },
      { variationId: 12, stock: 3 },
    ]
    expect(normalizeStockByVariation(raw)).toEqual({ '9': 5, '12': 3 })
  })

  it('coerce les valeurs non numériques en 0', () => {
    const raw = [{ variationId: '1', stock: 'abc' as unknown as number }]
    expect(normalizeStockByVariation(raw)).toEqual({ '1': 0 })
  })

  it('retourne undefined si array vide', () => {
    expect(normalizeStockByVariation([])).toBeUndefined()
  })

  it('passe un objet legacy en l\'état', () => {
    const legacy = { '1': 5, '2': 3 }
    expect(normalizeStockByVariation(legacy)).toEqual(legacy)
  })

  it('ignore les entrées sans variationId', () => {
    const raw = [
      { variationId: '1', stock: 5 },
      { stock: 99 } as unknown as { variationId: string, stock: number },
    ]
    expect(normalizeStockByVariation(raw)).toEqual({ '1': 5 })
  })
})

describe('applyEstablishmentOverrides — sans establishmentId (mode global)', () => {
  it('retourne les valeurs globales du produit', () => {
    const result = applyEstablishmentOverrides(makeRow(), undefined)

    expect(result).toMatchObject({
      id: 1,
      name: 'Produit Global',
      description: 'Description globale',
      barcode: '123',
      categoryId: 10,
      supplierId: 20,
      brandId: 30,
      price: 9.99,
      purchasePrice: 5,
      tva: 20,
      stock: 50,
      minStock: 10,
      isAvailable: true,
      establishmentId: null,
    })
  })

  it('ignore les overrides quand establishmentId absent', () => {
    const row = makeRow({
      nameOverride: 'Override Name',
      priceOverride: '20.00',
      stock: 50,
      establishmentStock: 999,
    })
    const result = applyEstablishmentOverrides(row, undefined)

    expect(result.name).toBe('Produit Global')
    expect(result.price).toBe(9.99)
    expect(result.priceOverride).toBeUndefined()
    expect(result.stock).toBe(50)
  })

  it('description vide → chaîne vide', () => {
    expect(applyEstablishmentOverrides(makeRow({ description: null }), undefined).description).toBe('')
  })

  it('barcode null → chaîne vide', () => {
    expect(applyEstablishmentOverrides(makeRow({ barcode: null }), undefined).barcode).toBe('')
  })

  it('tva null → fallback 20', () => {
    expect(applyEstablishmentOverrides(makeRow({ tva: null }), undefined).tva).toBe(20)
  })

  it('purchasePrice null → undefined (pas 0)', () => {
    expect(applyEstablishmentOverrides(makeRow({ purchasePrice: null }), undefined).purchasePrice).toBeUndefined()
  })

  it('minStock null → fallback 5', () => {
    expect(applyEstablishmentOverrides(makeRow({ minStock: null }), undefined).minStock).toBe(5)
  })

  it('stock null → fallback 0', () => {
    expect(applyEstablishmentOverrides(makeRow({ stock: null }), undefined).stock).toBe(0)
  })

  it('isAvailable est toujours true en mode global', () => {
    const row = makeRow({ isAvailableLocally: false })
    expect(applyEstablishmentOverrides(row, undefined).isAvailable).toBe(true)
  })
})

describe('applyEstablishmentOverrides — avec establishmentId (mode scoped)', () => {
  it('utilise les overrides quand ils sont définis', () => {
    const row = makeRow({
      nameOverride: 'Nom Local',
      descriptionOverride: 'Desc Locale',
      barcodeOverride: '999',
      categoryIdOverride: 100,
      supplierIdOverride: 200,
      brandIdOverride: 300,
      imageOverride: '/local.png',
      tvaOverride: '5.5',
      priceOverride: '15.00',
      purchasePriceOverride: '8.00',
    })
    const result = applyEstablishmentOverrides(row, 5)

    expect(result).toMatchObject({
      name: 'Nom Local',
      description: 'Desc Locale',
      barcode: '999',
      categoryId: 100,
      supplierId: 200,
      brandId: 300,
      image: '/local.png',
      tva: 5.5,
      price: 15,
      purchasePrice: 8,
      priceOverride: 15,
      purchasePriceOverride: 8,
      establishmentId: 5,
    })
  })

  it('fallback sur les valeurs globales si override absent', () => {
    const row = makeRow({
      nameOverride: null,
      priceOverride: null,
    })
    const result = applyEstablishmentOverrides(row, 5)

    expect(result.name).toBe('Produit Global')
    expect(result.price).toBe(9.99)
    expect(result.priceOverride).toBeUndefined()
  })

  it('utilise establishmentStock plutôt que stock global', () => {
    const row = makeRow({ stock: 50, establishmentStock: 12 })
    expect(applyEstablishmentOverrides(row, 5).stock).toBe(12)
  })

  it('establishmentStock null → fallback 0 (pas le stock global)', () => {
    const row = makeRow({ stock: 50, establishmentStock: null })
    expect(applyEstablishmentOverrides(row, 5).stock).toBe(0)
  })

  it('establishmentMinStock null → fallback 5', () => {
    const row = makeRow({ minStock: 99, establishmentMinStock: null })
    expect(applyEstablishmentOverrides(row, 5).minStock).toBe(5)
  })

  it('isAvailable utilise isAvailableLocally', () => {
    expect(applyEstablishmentOverrides(makeRow({ isAvailableLocally: false }), 5).isAvailable).toBe(false)
    expect(applyEstablishmentOverrides(makeRow({ isAvailableLocally: true }), 5).isAvailable).toBe(true)
  })

  it('isAvailableLocally null → defaut true', () => {
    expect(applyEstablishmentOverrides(makeRow({ isAvailableLocally: null }), 5).isAvailable).toBe(true)
  })

  it('normalise establishmentStockByVariation array → objet', () => {
    const row = makeRow({
      establishmentStockByVariation: [
        { variationId: '9', stock: 3 },
        { variationId: '10', stock: 7 },
      ],
    })
    expect(applyEstablishmentOverrides(row, 5).stockByVariation).toEqual({ '9': 3, '10': 7 })
  })

  it('variationGroupIdsOverride remplace variationGroupIds', () => {
    const row = makeRow({
      variationGroupIds: [1, 2],
      variationGroupIdsOverride: [99],
    })
    expect(applyEstablishmentOverrides(row, 5).variationGroupIds).toEqual([99])
  })

  it('establishmentId du résultat = celui passé en argument', () => {
    const row = makeRow({ establishmentId: 999 })
    expect(applyEstablishmentOverrides(row, 5).establishmentId).toBe(5)
  })

  it('tvaOverride "0" est appliqué (string non vide → truthy)', () => {
    // Cas métier : produit normalement à 20% TVA, override "0" pour un établissement
    // exonéré. La string "0" est truthy en JS donc l'override s'applique correctement.
    const row = makeRow({ tva: '20', tvaOverride: '0' })
    expect(applyEstablishmentOverrides(row, 5).tva).toBe(0)
  })

  it('tvaOverride chaîne vide → fallback global (string vide est falsy)', () => {
    const row = makeRow({ tva: '20', tvaOverride: '' })
    expect(applyEstablishmentOverrides(row, 5).tva).toBe(20)
  })
})
