import { describe, it, expect, beforeEach, vi } from 'vitest'
import { calculatePointsForSale } from '~/server/utils/loyalty'

vi.mock('~/server/utils/sync', () => ({
  getSyncGroupsForEstablishment: vi.fn(() => Promise.resolve([])),
}))

vi.mock('~/server/database/connection', () => ({
  db: {},
}))

describe('calculatePointsForSale', () => {
  it('per_euro : 1 point par € arrondi inférieur', () => {
    expect(calculatePointsForSale(15.80, 'per_euro')).toBe(15)
    expect(calculatePointsForSale(0.99, 'per_euro')).toBe(0)
    expect(calculatePointsForSale(1.0, 'per_euro')).toBe(1)
    expect(calculatePointsForSale(100, 'per_euro')).toBe(100)
  })

  it('per_ticket : 1 point par ticket', () => {
    expect(calculatePointsForSale(0.50, 'per_ticket')).toBe(1)
    expect(calculatePointsForSale(150, 'per_ticket')).toBe(1)
  })

  it('totalTTC ≤ 0 → 0 point (échange ou remboursement)', () => {
    expect(calculatePointsForSale(0, 'per_euro')).toBe(0)
    expect(calculatePointsForSale(-50, 'per_euro')).toBe(0)
    expect(calculatePointsForSale(0, 'per_ticket')).toBe(0)
    expect(calculatePointsForSale(-50, 'per_ticket')).toBe(0)
  })
})

// ===========================================
// Tests de getActiveLoyaltyConfig + getLoyaltyScopeEstablishmentIds + getCustomerLoyaltyPoints
// nécessitent un mock plus complet de db (chain). Couverts dans tests/api/sales.test.ts
// via la mise à jour du flow create. On laisse ici juste la fonction pure.
// ===========================================

describe('getActiveLoyaltyConfig (smoke import)', () => {
  beforeEach(() => vi.resetModules())
  it('le module exporte la fonction', async () => {
    const { getActiveLoyaltyConfig } = await import('~/server/utils/loyalty')
    expect(typeof getActiveLoyaltyConfig).toBe('function')
  })
})

describe('getLoyaltyScopeEstablishmentIds (smoke import)', () => {
  it('le module exporte la fonction', async () => {
    const { getLoyaltyScopeEstablishmentIds } = await import('~/server/utils/loyalty')
    expect(typeof getLoyaltyScopeEstablishmentIds).toBe('function')
  })
})

describe('getCustomerLoyaltyPoints (smoke import)', () => {
  it('le module exporte la fonction', async () => {
    const { getCustomerLoyaltyPoints } = await import('~/server/utils/loyalty')
    expect(typeof getCustomerLoyaltyPoints).toBe('function')
  })
})
