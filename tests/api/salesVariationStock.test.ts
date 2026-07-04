import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent } from '../setup'
import { logger } from '~/server/utils/logger'

// Régression : le déstockage d'un produit à variations doit TOUJOURS passer par
// stockByVariation, même si le tableau est vide ou sans entrée pour la variation
// vendue (l'entrée est créée à la volée). Jamais de fallback sur le stock global.
// La caisse envoie des NOMS de variation (y compris purement numériques, ex.
// taille « 38 ») : ils sont résolus vers l'ID parmi les variations du produit,
// jamais interprétés directement comme des IDs.

// Override createError (comme sales.test.ts) pour que rejects.toMatchObject fonctionne
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}
;(globalThis as Record<string, unknown>).getRequestIP = () => '127.0.0.1'

vi.mock('~/server/validators/sale.schema', () => ({
  createSaleRequestSchema: {},
}))

vi.mock('~/server/utils/nf525', () => ({
  generateTicketNumber: vi.fn(() => '20240115-E01-R01-000001'),
  generateTicketHash: vi.fn(() => 'mock-hash-abc123'),
  generateTicketSignature: vi.fn(() => 'mock-signature-xyz'),
}))

vi.mock('~/server/utils/audit', () => ({
  logSaleCreation: vi.fn(() => Promise.resolve()),
  logSystemError: vi.fn(() => Promise.resolve()),
}))

vi.mock('~/server/utils/financialValidation', () => ({
  recomputeTotalTTC: vi.fn(() => 10),
  validateTotalTTC: vi.fn(() => true),
  recomputeHTandTVA: vi.fn(() => ({ totalHT: 8.33, totalTVA: 1.67 })),
}))

vi.mock('~/server/utils/loyalty', () => ({
  getActiveLoyaltyConfig: vi.fn(() => Promise.resolve(null)),
  calculatePointsForSale: vi.fn(() => 0),
  getCustomerLoyaltyPoints: vi.fn(() => Promise.resolve(0)),
}))

vi.mock('~/server/utils/purchasePriceSnapshot', () => ({
  resolvePurchasePriceAtSale: vi.fn(() => null),
}))

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  asc: (...args: unknown[]) => ({ type: 'asc', args }),
  gt: (...args: unknown[]) => ({ type: 'gt', args }),
  gte: (...args: unknown[]) => ({ type: 'gte', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  isNull: (...args: unknown[]) => ({ type: 'isNull', args }),
}))

vi.mock('~/server/database/schema', () => ({
  sales: { __table: 'sales' },
  saleItems: { __table: 'saleItems' },
  stockMovements: { __table: 'stockMovements' },
  products: { __table: 'products', id: 'products.id', tenantId: 'products.tenantId', purchasePrice: 'products.purchasePrice', variationGroupIds: 'products.variationGroupIds' },
  productEstablishments: { __table: 'productEstablishments', productId: 'pe.productId', establishmentId: 'pe.establishmentId', tenantId: 'pe.tenantId', purchasePriceOverride: 'pe.purchasePriceOverride' },
  variations: { __table: 'variations', id: 'variations.id', name: 'variations.name', tenantId: 'variations.tenantId' },
  registers: { __table: 'registers', id: 'r.id', tenantId: 'r.tenantId', establishmentId: 'r.establishmentId', name: 'r.name', registerNumber: 'r.registerNumber', isActive: 'r.isActive' },
  establishments: { __table: 'establishments', id: 'e.id', tenantId: 'e.tenantId', name: 'e.name', establishmentNumber: 'e.establishmentNumber', isActive: 'e.isActive' },
  closures: { __table: 'closures', tenantId: 'c.tenantId', closureDate: 'c.closureDate', registerId: 'c.registerId' },
  productStocks: { __table: 'productStocks', productId: 'ps.productId', establishmentId: 'ps.establishmentId', tenantId: 'ps.tenantId', stock: 'ps.stock', stockByVariation: 'ps.stockByVariation', updatedAt: 'ps.updatedAt' },
  customers: { __table: 'customers', id: 'cu.id', tenantId: 'cu.tenantId', loyaltyProgram: 'cu.loyaltyProgram' },
  customerEstablishments: { __table: 'customerEstablishments' },
  loyaltyVouchers: { __table: 'loyaltyVouchers' },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentDb: any

vi.mock('~/server/database/connection', () => ({
  get db() { return currentDb }
}))

interface CapturedInsert { table: string; values: unknown }
interface CapturedUpdate { table: string; set: Record<string, unknown> }

function createSaleDb(selectResults: unknown[][]) {
  const inserted: CapturedInsert[] = []
  const updated: CapturedUpdate[] = []
  let selectIdx = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(selectResults[selectIdx - 1] || []).then(resolve, reject),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: vi.fn(() => { selectIdx++; return chain }),
    execute: vi.fn(() => Promise.resolve()),
    insert: vi.fn((table: { __table: string }) => ({
      values: (values: unknown) => {
        inserted.push({ table: table.__table, values })
        return {
          returning: () => Promise.resolve([{ id: 42, ticketNumber: '20240115-E01-R01-000001', saleDate: new Date(), totalTTC: '10.00', currentHash: 'mock-hash-abc123', signature: 'mock-signature-xyz' }]),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(undefined).then(resolve, reject),
        }
      },
    })),
    update: vi.fn((table: { __table: string }) => ({
      set: (set: Record<string, unknown>) => {
        updated.push({ table: table.__table, set })
        return {
          where: () => ({
            then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
              Promise.resolve(undefined).then(resolve, reject),
          }),
        }
      },
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  }
  return { db, inserted, updated }
}

const register = { id: 1, tenantId: 'test-tenant-id', establishmentId: 10, name: 'Caisse 1', registerNumber: 1 }
const establishment = { id: 10, name: 'Boutique', establishmentNumber: 1 }

interface SelectOpts {
  productRows?: unknown[]
  overrideRows?: unknown[]
  variationRows?: unknown[]
}

/**
 * Résultats des SELECT dans l'ordre d'exécution du handler (sans client ni voucher) :
 * 1. register, 2. establishment, 3. closure du jour,
 * puis en transaction : 4. lastSale, 5. lastTicket,
 * 6. basePurchasePrices (avec variationGroupIds),
 * 7. overridePurchasePrices (avec variationGroupIdsOverride),
 * 8. allProductStocks,
 * 9. (si variations du produit à résoudre) variations par ID
 */
function buildSelects(stockRows: unknown[], opts: SelectOpts = {}): unknown[][] {
  const selects: unknown[][] = [[register], [establishment], [], [], [], opts.productRows || [], opts.overrideRows || [], stockRows]
  if (opts.variationRows) selects.push(opts.variationRows)
  return selects
}

function buildBody(items: Array<{ productId: number; productName: string; quantity: number; variation?: string; variationId?: number | null }>) {
  return {
    items: items.map(i => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: 10,
      variation: i.variation,
      variationId: i.variationId ?? null,
      discount: 0,
      discountType: '%' as const,
      tva: 20,
    })),
    seller: { id: 1, name: 'Alice' },
    customer: null,
    payments: [{ mode: 'cash', amount: 10 }],
    totals: { totalHT: 8.33, totalTVA: 1.67, totalTTC: 10 },
    globalDiscount: { value: 0, type: '%' as const },
    establishmentId: 10,
    registerId: 1,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSale(stockRows: unknown[], items: any[], opts: SelectOpts = {}) {
  const { db, inserted, updated } = createSaleDb(buildSelects(stockRows, opts))
  currentDb = db
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (await import('~/server/api/sales/create.post')).default as any
  const response = await handler(createMockEvent({ body: buildBody(items) }))
  return { response, inserted, updated }
}

function getStockMovements(inserted: CapturedInsert[]) {
  const entry = inserted.find(i => i.table === 'stockMovements')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (entry?.values || []) as any[]
}

function getProductStockUpdates(updated: CapturedUpdate[]) {
  return updated.filter(u => u.table === 'productStocks')
}

// ===========================================
// Tests
// ===========================================

describe('POST /api/sales/create — déstockage produit à variations', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(logger.warn).mockClear()
  })

  it('variationId explicite : clé de stock directe (prioritaire sur le nom), persisté sur la ligne de vente', async () => {
    // La caisse envoie l'ID exact : pas d'ambiguïté même si le nom (« 38 »)
    // correspond aussi à l'ID d'une autre variation du produit.
    const { response, inserted, updated } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [{ variationId: '38', stock: 6 }] }],
      [{ productId: 2, productName: 'Chaussure', quantity: 2, variation: '38', variationId: 152 }],
      {
        productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [152, 38] }],
        variationRows: [{ id: 152, name: '38' }, { id: 38, name: 'Rouge' }],
      },
    )

    expect(response.success).toBe(true)
    const stockUpdates = getProductStockUpdates(updated)
    expect(stockUpdates).toHaveLength(1)
    expect(stockUpdates[0]!.set.stockByVariation).toEqual(
      expect.arrayContaining([
        { variationId: '38', stock: 6 },
        { variationId: '152', stock: -2 },
      ])
    )
    expect(stockUpdates[0]!.set.stock).toBeUndefined()

    // variationId persisté sur la ligne de vente (clé exacte pour l'avoir)
    const saleItemsInsert = inserted.find(i => i.table === 'saleItems')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((saleItemsInsert?.values as any[])[0]).toMatchObject({ variation: '38', variationId: 152 })
  })

  it('variationId inconnu (stale) : fallback sur la résolution par nom', async () => {
    const { response, updated } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [] }],
      [{ productId: 2, productName: 'T-shirt', quantity: 1, variation: 'Rouge', variationId: 999 }],
      {
        productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [7] }],
        variationRows: [{ id: 7, name: 'Rouge' }],
      },
    )

    expect(response.success).toBe(true)
    const stockUpdates = getProductStockUpdates(updated)
    expect(stockUpdates).toHaveLength(1)
    expect(stockUpdates[0]!.set.stockByVariation).toEqual([{ variationId: '7', stock: -1 }])
    expect(stockUpdates[0]!.set.stock).toBeUndefined()
  })

  it('variationId inconnu et nom irrésolvable : AUCUN stock modifié', async () => {
    const { response, updated, inserted } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [] }],
      [{ productId: 2, productName: 'T-shirt', quantity: 1, variation: 'Fuchsia', variationId: 999 }],
      {
        productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [7] }],
        variationRows: [{ id: 7, name: 'Rouge' }],
      },
    )

    expect(response.success).toBe(true)
    expect(getProductStockUpdates(updated)).toHaveLength(0)
    expect(inserted.find(i => i.table === 'stockMovements')).toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 2, variationId: 999 }),
      expect.stringContaining('Variation inconnue'),
    )
  })

  it('nom purement numérique (« 38 ») : résolu comme NOM parmi les variations du produit, jamais comme ID', async () => {
    // Piège : le produit a AUSSI une variation dont l'ID est 38 (« Rouge »),
    // avec une entrée existante '38' dans le tableau. Le nom doit primer :
    // c'est la variation nommée « 38 » (ID 152) qui doit être déstockée.
    const { response, inserted, updated } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [{ variationId: '38', stock: 6 }] }],
      [{ productId: 2, productName: 'Chaussure', quantity: 2, variation: '38' }],
      {
        productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [152, 38] }],
        variationRows: [{ id: 152, name: '38' }, { id: 38, name: 'Rouge' }],
      },
    )

    expect(response.success).toBe(true)
    const stockUpdates = getProductStockUpdates(updated)
    expect(stockUpdates).toHaveLength(1)
    // L'entrée de la variation nommée « 38 » (ID 152) est créée et décrémentée…
    expect(stockUpdates[0]!.set.stockByVariation).toEqual(
      expect.arrayContaining([
        { variationId: '38', stock: 6 }, // …l'entrée de l'ID 38 (« Rouge ») est intacte
        { variationId: '152', stock: -2 },
      ])
    )
    expect(stockUpdates[0]!.set.stock).toBeUndefined()

    const movements = getStockMovements(inserted)
    expect(movements[0]).toMatchObject({
      productId: 2,
      variation: '38',
      oldStock: 0,
      newStock: -2,
      oversell: true,
    })
  })

  it('stockByVariation vide : crée l\'entrée de la variation, ne touche PAS au stock global', async () => {
    const { response, inserted, updated } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [] }],
      [{ productId: 2, productName: 'T-shirt', quantity: 2, variation: 'Rouge' }],
      {
        productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [7] }],
        variationRows: [{ id: 7, name: 'Rouge' }],
      },
    )

    expect(response.success).toBe(true)

    const stockUpdates = getProductStockUpdates(updated)
    expect(stockUpdates).toHaveLength(1)
    // Le déstockage se fait sur la variation (entrée créée à la volée)…
    expect(stockUpdates[0]!.set.stockByVariation).toEqual([{ variationId: '7', stock: -2 }])
    // …et surtout pas sur le stock global
    expect(stockUpdates[0]!.set.stock).toBeUndefined()

    const movements = getStockMovements(inserted)
    expect(movements[0]).toMatchObject({
      productId: 2,
      variation: 'Rouge',
      oldStock: 0,
      newStock: -2,
      oversell: true,
    })
  })

  it('stockByVariation null : idem, jamais de fallback sur le stock global', async () => {
    const { response, updated } = await runSale(
      [{ productId: 2, stock: 8, stockByVariation: null }],
      [{ productId: 2, productName: 'T-shirt', quantity: 1, variation: 'Rouge' }],
      {
        productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [7] }],
        variationRows: [{ id: 7, name: 'Rouge' }],
      },
    )

    expect(response.success).toBe(true)
    const stockUpdates = getProductStockUpdates(updated)
    expect(stockUpdates).toHaveLength(1)
    expect(stockUpdates[0]!.set.stockByVariation).toEqual([{ variationId: '7', stock: -1 }])
    expect(stockUpdates[0]!.set.stock).toBeUndefined()
  })

  it('override établissement : les variations locales remplacent celles de la base', async () => {
    const { response, updated } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [] }],
      [{ productId: 2, productName: 'T-shirt', quantity: 1, variation: 'Rouge' }],
      {
        productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [7] }],
        overrideRows: [{ productId: 2, purchasePriceOverride: null, variationGroupIdsOverride: [9] }],
        variationRows: [{ id: 9, name: 'Rouge' }],
      },
    )

    expect(response.success).toBe(true)
    const stockUpdates = getProductStockUpdates(updated)
    expect(stockUpdates).toHaveLength(1)
    expect(stockUpdates[0]!.set.stockByVariation).toEqual([{ variationId: '9', stock: -1 }])
  })

  it('clé brute déjà présente dans le tableau (legacy) : utilisée telle quelle si le nom ne résout pas', async () => {
    const { response, updated } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [{ variationId: '7', stock: 10 }, { variationId: '8', stock: 4 }] }],
      [{ productId: 2, productName: 'Chaussure', quantity: 2, variation: '7' }],
    )

    expect(response.success).toBe(true)
    const stockUpdates = getProductStockUpdates(updated)
    expect(stockUpdates).toHaveLength(1)
    expect(stockUpdates[0]!.set.stockByVariation).toEqual(
      expect.arrayContaining([
        { variationId: '7', stock: 8 },
        { variationId: '8', stock: 4 },
      ])
    )
    expect(stockUpdates[0]!.set.stock).toBeUndefined()
  })

  it('nom de variation irrésolvable : AUCUN stock modifié (ni variation ni global), vente OK', async () => {
    const { response, inserted, updated } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [] }],
      [{ productId: 2, productName: 'T-shirt', quantity: 1, variation: 'Fuchsia' }],
      {
        productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [7] }],
        variationRows: [{ id: 7, name: 'Rouge' }], // « Fuchsia » n'existe pas
      },
    )

    expect(response.success).toBe(true)
    expect(getProductStockUpdates(updated)).toHaveLength(0)
    expect(inserted.find(i => i.table === 'stockMovements')).toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 2 }),
      expect.stringContaining('Variation inconnue'),
    )
  })

  it('produit à variations vendu sans variation : le stock global n\'est PAS décrémenté', async () => {
    const { response, inserted, updated } = await runSale(
      [{ productId: 2, stock: 5, stockByVariation: [] }],
      [{ productId: 2, productName: 'Chaussure', quantity: 1 }], // pas de variation
      { productRows: [{ id: 2, purchasePrice: null, variationGroupIds: [7, 8] }] },
    )

    expect(response.success).toBe(true)
    expect(getProductStockUpdates(updated)).toHaveLength(0)
    expect(inserted.find(i => i.table === 'stockMovements')).toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 2 }),
      expect.stringContaining('Produit à variations vendu sans variation'),
    )
  })

  it('produit SANS variations vendu sans variation : décrément du stock global (non-régression)', async () => {
    const { response, updated } = await runSale(
      [{ productId: 1, stock: 5, stockByVariation: null }],
      [{ productId: 1, productName: 'Mug', quantity: 2 }],
      { productRows: [{ id: 1, purchasePrice: null, variationGroupIds: null }] },
    )

    expect(response.success).toBe(true)
    const stockUpdates = getProductStockUpdates(updated)
    expect(stockUpdates).toHaveLength(1)
    expect(stockUpdates[0]!.set.stock).toBe(3)
    expect(stockUpdates[0]!.set.stockByVariation).toBeUndefined()
  })
})
