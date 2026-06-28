import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSaleRequestSchema } from '~/server/validators/sale.schema'

// ===========================================
// Fake DB : simule la table sales avec l'index unique (tenant_id, client_sale_id).
// Permet de tester le contrat d'idempotence sans PostgreSQL.
// ===========================================

interface FakeSaleRow {
  id: number
  tenantId: string
  clientSaleId: string | null
  ticketNumber: string
  saleDate: Date
  totalTTC: string
  currentHash: string
  signature: string | null
  establishmentId: number | null
  registerId: number | null
}

const fakeSales: FakeSaleRow[] = []
let lookupArgs: { tenantId?: string, clientSaleId?: string } = {}

vi.mock('~/server/database/connection', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => fakeSales.filter(
            s => s.tenantId === lookupArgs.tenantId && s.clientSaleId === lookupArgs.clientSaleId
          ).slice(0, 1),
        }),
      }),
    }),
  },
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (_col: unknown, val: unknown) => val,
    and: (tenantId: string, clientSaleId: string) => {
      lookupArgs = { tenantId, clientSaleId }
      return lookupArgs
    },
  }
})

const { findExistingSaleByClientSaleId, buildDuplicateSaleResponse } = await import('~/server/utils/saleIdempotency')

// Simule le comportement du endpoint create.post.ts : check d'idempotence
// en tête, puis insert (avec contrainte unique) si pas de doublon.
async function simulateCreateSale(tenantId: string, clientSaleId: string | null) {
  if (clientSaleId) {
    const existing = await findExistingSaleByClientSaleId(tenantId, clientSaleId)
    if (existing) return buildDuplicateSaleResponse(existing)
  }

  // Filet de sécurité : l'index unique sales_tenant_client_sale_id_unique
  if (clientSaleId && fakeSales.some(s => s.tenantId === tenantId && s.clientSaleId === clientSaleId)) {
    throw new Error('duplicate key value violates unique constraint "sales_tenant_client_sale_id_unique"')
  }

  const row: FakeSaleRow = {
    id: fakeSales.length + 1,
    tenantId,
    clientSaleId,
    ticketNumber: `2026-01-1-${fakeSales.length + 1}`,
    saleDate: new Date(),
    totalTTC: '12.00',
    currentHash: `hash-${fakeSales.length + 1}`,
    signature: null,
    establishmentId: 1,
    registerId: 1,
  }
  fakeSales.push(row)

  return {
    success: true as const,
    duplicate: false as const,
    stockWarnings: [],
    sale: {
      id: row.id,
      ticketNumber: row.ticketNumber,
      saleDate: row.saleDate,
      totalTTC: row.totalTTC,
      hash: row.currentHash,
      signature: row.signature,
      establishmentId: row.establishmentId,
      registerId: row.registerId,
      loyalty: null,
    },
  }
}

describe('idempotence des ventes (clientSaleId)', () => {
  beforeEach(() => {
    fakeSales.length = 0
    lookupArgs = {}
  })

  it('même payload envoyé 2 fois → une seule vente, deuxième réponse duplicate: true', async () => {
    const clientSaleId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

    const first = await simulateCreateSale('tenant-1', clientSaleId)
    expect(first.duplicate).toBe(false)
    expect(fakeSales).toHaveLength(1)

    const second = await simulateCreateSale('tenant-1', clientSaleId)
    expect(second.duplicate).toBe(true)
    expect(fakeSales).toHaveLength(1)

    // Même vente, même shape de réponse
    expect(second.sale.id).toBe(first.sale.id)
    expect(second.sale.ticketNumber).toBe(first.sale.ticketNumber)
    expect(second.sale.hash).toBe(first.sale.hash)
    expect(Object.keys(second.sale).sort()).toEqual(Object.keys(first.sale).sort())
  })

  it('deux clientSaleId différents → deux ventes distinctes', async () => {
    const first = await simulateCreateSale('tenant-1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    const second = await simulateCreateSale('tenant-1', 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee')

    expect(fakeSales).toHaveLength(2)
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(false)
    expect(second.sale.id).not.toBe(first.sale.id)
  })

  it('même clientSaleId sur deux tenants différents → deux ventes (isolation)', async () => {
    const clientSaleId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const first = await simulateCreateSale('tenant-1', clientSaleId)
    const second = await simulateCreateSale('tenant-2', clientSaleId)

    expect(fakeSales).toHaveLength(2)
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(false)
  })

  it('sans clientSaleId (client ancien) → pas de dédoublonnage, rétro-compatible', async () => {
    await simulateCreateSale('tenant-1', null)
    const second = await simulateCreateSale('tenant-1', null)

    expect(fakeSales).toHaveLength(2)
    expect(second.duplicate).toBe(false)
  })
})

describe('validation Zod du clientSaleId', () => {
  const basePayload = {
    items: [{ productId: 1, productName: 'P', quantity: 1, unitPrice: 10, tva: 20 }],
    seller: { id: 1, name: 'V' },
    payments: [{ mode: 'Espèces', amount: 12 }],
    totals: { totalHT: 10, totalTVA: 2, totalTTC: 12 },
    globalDiscount: { value: 0, type: '%' as const },
    establishmentId: 1,
    registerId: 1,
  }

  it('accepte un UUID valide', () => {
    const result = createSaleRequestSchema.safeParse({
      ...basePayload,
      clientSaleId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    })
    expect(result.success).toBe(true)
  })

  it('accepte un payload sans clientSaleId (rétro-compatible)', () => {
    const result = createSaleRequestSchema.safeParse(basePayload)
    expect(result.success).toBe(true)
  })

  it('accepte clientSaleId: null', () => {
    const result = createSaleRequestSchema.safeParse({ ...basePayload, clientSaleId: null })
    expect(result.success).toBe(true)
  })

  it('rejette un clientSaleId non-UUID', () => {
    const result = createSaleRequestSchema.safeParse({ ...basePayload, clientSaleId: 'pas-un-uuid' })
    expect(result.success).toBe(false)
  })
})
