import { describe, it, expect } from 'vitest'
import { createArchiveSchema } from '~/server/validators/archive.schema'
import { resyncGroupSchema, patchSyncGroupEstablishmentsSchema } from '~/server/validators/sync.schema'

/**
 * Couverture Zod des 3 endpoints corrigés par Q3.
 * Ces tests valident les schémas en isolation — les handlers sont couverts
 * séparément (avec validateBody mocké au niveau setup global).
 */

describe('Q3 — createArchiveSchema', () => {
  it('accepte un payload valide monthly', () => {
    const r = createArchiveSchema.safeParse({ type: 'monthly', period: '2024-03' })
    expect(r.success).toBe(true)
  })

  it('accepte un payload valide yearly avec registerId', () => {
    const r = createArchiveSchema.safeParse({ type: 'yearly', period: '2024', registerId: 1 })
    expect(r.success).toBe(true)
  })

  it('rejette si type manquant', () => {
    const r = createArchiveSchema.safeParse({ period: '2024-03' })
    expect(r.success).toBe(false)
  })

  it('rejette si type invalide', () => {
    const r = createArchiveSchema.safeParse({ type: 'daily', period: '2024-03' })
    expect(r.success).toBe(false)
  })

  it('rejette si period manquante', () => {
    const r = createArchiveSchema.safeParse({ type: 'monthly' })
    expect(r.success).toBe(false)
  })

  it('rejette monthly avec format YYYY au lieu de YYYY-MM', () => {
    const r = createArchiveSchema.safeParse({ type: 'monthly', period: '2024' })
    expect(r.success).toBe(false)
  })

  it('rejette yearly avec format YYYY-MM au lieu de YYYY', () => {
    const r = createArchiveSchema.safeParse({ type: 'yearly', period: '2024-03' })
    expect(r.success).toBe(false)
  })

  it('rejette monthly avec mois 13', () => {
    const r = createArchiveSchema.safeParse({ type: 'monthly', period: '2024-13' })
    expect(r.success).toBe(false)
  })

  it('rejette registerId négatif', () => {
    const r = createArchiveSchema.safeParse({ type: 'yearly', period: '2024', registerId: -1 })
    expect(r.success).toBe(false)
  })
})

describe('Q3 — resyncGroupSchema', () => {
  it('accepte un payload valide produit', () => {
    const r = resyncGroupSchema.safeParse({
      sourceEstablishmentId: 1,
      entityType: 'product',
      fields: ['price', 'name'],
    })
    expect(r.success).toBe(true)
  })

  it('accepte un payload valide client', () => {
    const r = resyncGroupSchema.safeParse({
      sourceEstablishmentId: 2,
      entityType: 'customer',
      fields: ['email'],
    })
    expect(r.success).toBe(true)
  })

  it('rejette si sourceEstablishmentId manquant', () => {
    const r = resyncGroupSchema.safeParse({ entityType: 'product', fields: ['price'] })
    expect(r.success).toBe(false)
  })

  it('rejette si sourceEstablishmentId négatif', () => {
    const r = resyncGroupSchema.safeParse({
      sourceEstablishmentId: -1,
      entityType: 'product',
      fields: ['price'],
    })
    expect(r.success).toBe(false)
  })

  it('rejette si entityType invalide', () => {
    const r = resyncGroupSchema.safeParse({
      sourceEstablishmentId: 1,
      entityType: 'invalid',
      fields: ['price'],
    })
    expect(r.success).toBe(false)
  })

  it('rejette si fields vide', () => {
    const r = resyncGroupSchema.safeParse({
      sourceEstablishmentId: 1,
      entityType: 'product',
      fields: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejette si fields contient un string vide', () => {
    const r = resyncGroupSchema.safeParse({
      sourceEstablishmentId: 1,
      entityType: 'product',
      fields: [''],
    })
    expect(r.success).toBe(false)
  })

  it('rejette si fields n\'est pas un array', () => {
    const r = resyncGroupSchema.safeParse({
      sourceEstablishmentId: 1,
      entityType: 'product',
      fields: 'price',
    })
    expect(r.success).toBe(false)
  })
})

describe('Q3 — patchSyncGroupEstablishmentsSchema', () => {
  it('accepte un array d\'IDs valides', () => {
    const r = patchSyncGroupEstablishmentsSchema.safeParse({ establishmentIds: [1, 2, 3] })
    expect(r.success).toBe(true)
  })

  it('accepte un array vide (vidange du groupe)', () => {
    const r = patchSyncGroupEstablishmentsSchema.safeParse({ establishmentIds: [] })
    expect(r.success).toBe(true)
  })

  it('rejette si establishmentIds manquant', () => {
    const r = patchSyncGroupEstablishmentsSchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it('rejette si establishmentIds n\'est pas un array', () => {
    const r = patchSyncGroupEstablishmentsSchema.safeParse({ establishmentIds: 1 })
    expect(r.success).toBe(false)
  })

  it('rejette si un ID est négatif', () => {
    const r = patchSyncGroupEstablishmentsSchema.safeParse({ establishmentIds: [1, -2] })
    expect(r.success).toBe(false)
  })

  it('rejette si un ID est zéro', () => {
    const r = patchSyncGroupEstablishmentsSchema.safeParse({ establishmentIds: [0] })
    expect(r.success).toBe(false)
  })

  it('rejette si un ID n\'est pas un nombre', () => {
    const r = patchSyncGroupEstablishmentsSchema.safeParse({ establishmentIds: ['1'] })
    expect(r.success).toBe(false)
  })
})
