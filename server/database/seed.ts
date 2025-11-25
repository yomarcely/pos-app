// server/database/seed.ts
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db, closeConnection } from './connection'
import {
  archives,
  auditLogs,
  brands,
  categories,
  closures,
  customers,
  movements,
  products,
  saleItems,
  sales,
  sellers,
  stockMovements,
  suppliers,
  syncQueue,
  variationGroups,
  variations,
} from './schema'
import {
  brandsSeed,
  categoriesSeed,
  customersSeed,
  productsSeed,
  sellersSeed,
  suppliersSeed,
  variationGroupsSeed,
  variationsSeed,
} from './seed-data'

type SeedOptions = {
  reset?: boolean
}

type SeedResult = {
  categories: number
  suppliers: number
  brands: number
  variationGroups: number
  variations: number
  sellers: number
  customers: number
  products: number
}

type DbExecutor = {
  execute: (query: any) => Promise<any>
}

async function resetDatabase(executor: DbExecutor) {
  console.log('🧹 Réinitialisation des tables...')
  await executor.execute(sql`
    TRUNCATE TABLE
      sale_items,
      sales,
      stock_movements,
      movements,
      products,
      categories,
      variations,
      variation_groups,
      suppliers,
      brands,
      customers,
      sellers,
      audit_logs,
      closures,
      archives,
      sync_queue
    RESTART IDENTITY CASCADE
  `)
}

function productPayloads() {
  return productsSeed.map((product) => ({
    id: product.id,
    name: product.name,
    barcode: product.barcode || null,
    price: product.price.toString(),
    purchasePrice: product.purchasePrice?.toString() || null,
    tva: product.tva?.toString() || '20',
    stock: product.stock ?? 0,
    stockByVariation: product.stockByVariation ? product.stockByVariation : null,
    minStock: 0,
    minStockByVariation: null,
    variationGroupIds: product.variationIds ? product.variationIds : null,
    categoryId: product.categoryId ?? null,
    supplierId: product.supplierId ?? null,
    brandId: product.brandId ?? null,
    image: product.image || null,
    description: null,
  }))
}

export async function seedDatabase(options: SeedOptions = {}): Promise<SeedResult> {
  const reset = options.reset ?? true
  console.log('🌱 Démarrage du seed de la base de données...')

  return db.transaction(async (tx) => {
    if (reset) {
      await resetDatabase(tx)
    }

    const insertedCategories = await tx
      .insert(categories)
      .values(categoriesSeed)
      .onConflictDoNothing({ target: categories.id })
      .returning({ id: categories.id })

    const insertedSuppliers = await tx
      .insert(suppliers)
      .values(suppliersSeed)
      .onConflictDoNothing({ target: suppliers.id })
      .returning({ id: suppliers.id })

    const insertedBrands = await tx
      .insert(brands)
      .values(brandsSeed)
      .onConflictDoNothing({ target: brands.id })
      .returning({ id: brands.id })

    const insertedVariationGroups = await tx
      .insert(variationGroups)
      .values(variationGroupsSeed)
      .onConflictDoNothing({ target: variationGroups.id })
      .returning({ id: variationGroups.id })

    const insertedVariations = await tx
      .insert(variations)
      .values(variationsSeed)
      .onConflictDoNothing({ target: variations.id })
      .returning({ id: variations.id })

    const insertedSellers = await tx
      .insert(sellers)
      .values(sellersSeed.map((seller, index) => ({
        ...seller,
        code: seller.code || `SLR-${String(index + 1).padStart(3, '0')}`,
      })))
      .onConflictDoNothing({ target: sellers.id })
      .returning({ id: sellers.id })

    const insertedCustomers = await tx
      .insert(customers)
      .values(
        customersSeed.map((customer) => ({
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email || null,
          phone: customer.phone || null,
          address: customer.address || null,
          metadata: {
            city: customer.city,
            postalCode: customer.postalCode,
          },
          gdprConsent: true,
          gdprConsentDate: new Date(),
        })),
      )
      .onConflictDoNothing({ target: customers.id })
      .returning({ id: customers.id })

    const insertedProducts = await tx
      .insert(products)
      .values(productPayloads())
      .onConflictDoNothing({ target: products.id })
      .returning({ id: products.id })

    const summary: SeedResult = {
      categories: insertedCategories.length,
      suppliers: insertedSuppliers.length,
      brands: insertedBrands.length,
      variationGroups: insertedVariationGroups.length,
      variations: insertedVariations.length,
      sellers: insertedSellers.length,
      customers: insertedCustomers.length,
      products: insertedProducts.length,
    }

    console.log('✨ Seed terminé avec succès!')
    console.table(summary)

    return summary
  })
}

// Exécution CLI manuelle (ne se déclenche pas en dev parce que RUN_SEED n'est pas défini)
const wantsCliRun = ['1', 'true', 'yes'].includes(String(process.env.RUN_SEED || '').toLowerCase())
const isNitro = Boolean(process.env.NITRO_PRESET || process.env.NITRO_APP || process.env.NUXT_DEV)
const isDirectRun = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href

if (isDirectRun && wantsCliRun && !isNitro) {
  const shouldReset = !process.argv.includes('--no-reset')

  seedDatabase({ reset: shouldReset })
    .then(async () => {
      console.log('✅ Script de seed terminé')
      await closeConnection()
      process.exit(0)
    })
    .catch(async (error) => {
      console.error('❌ Erreur fatale:', error)
      await closeConnection()
      process.exit(1)
    })
}
