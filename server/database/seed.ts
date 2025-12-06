// server/database/seed.ts
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db, closeConnection } from './connection'
import {
  brands,
  categories,
  customers,
  products,
  sellers,
  suppliers,
  variationGroups,
  variations,
  establishments,
  registers,
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
  tenantId?: string
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
      registers,
      establishments,
      audit_logs,
      closures,
      archives
    RESTART IDENTITY CASCADE
  `)
}

export async function seedDatabase(options: SeedOptions = {}): Promise<SeedResult> {
  const reset = options.reset ?? true
  console.log('🌱 Démarrage du seed de la base de données...')

  const tenants = [
    {
      id: 'f831a590-f365-4302-8aaf-1a7ac06d357d',
      label: 'Vape',
      categories: categoriesSeed,
      suppliers: suppliersSeed,
      brands: brandsSeed,
      variationGroups: variationGroupsSeed,
      variations: variationsSeed,
      sellers: sellersSeed,
      customers: customersSeed,
      products: productsSeed,
      establishments: [
        {
          id: 1,
          name: 'Vape Shop Centre',
          address: '12 rue du Nuage',
          postalCode: '75001',
          city: 'Paris',
          country: 'France',
          phone: '0102030405',
          email: 'contact@vapecentre.test',
          siret: '12345678900011',
          naf: '4726Z',
          tvaNumber: 'FR48123456789',
        },
        {
          id: 2,
          name: 'Vape Shop Sud',
          address: '5 avenue du Soleil',
          postalCode: '13001',
          city: 'Marseille',
          country: 'France',
          phone: '0405060708',
          email: 'sud@vapecentre.test',
          siret: '12345678900029',
          naf: '4726Z',
          tvaNumber: 'FR48123456789',
        },
      ],
    },
    {
      id: '9da91f8f-7513-451c-8a07-9008fa697a88',
      label: 'Vêtements',
      categories: [
        { id: 101, name: 'T-Shirts' },
        { id: 102, name: 'Jeans' },
        { id: 103, name: 'Accessoires' },
      ],
      suppliers: [
        { id: 101, name: 'Fournisseur Mode', email: 'hello@mode.test', phone: '0600000001' },
        { id: 102, name: 'Textile Plus', email: 'contact@textileplus.test', phone: '0600000002' },
      ],
      brands: [
        { id: 101, name: 'UrbanWear' },
        { id: 102, name: 'DenimCo' },
      ],
      variationGroups: [
        { id: 101, name: 'Taille' },
        { id: 102, name: 'Couleur' },
      ],
      variations: [
        { id: 101, groupId: 101, name: 'S', sortOrder: 1 },
        { id: 102, groupId: 101, name: 'M', sortOrder: 2 },
        { id: 103, groupId: 101, name: 'L', sortOrder: 3 },
        { id: 104, groupId: 102, name: 'Noir', sortOrder: 1 },
        { id: 105, groupId: 102, name: 'Bleu', sortOrder: 2 },
      ],
      sellers: [
        { id: 101, name: 'Alice', code: 'SLR-101' },
        { id: 102, name: 'Bob', code: 'SLR-102' },
      ],
      customers: [
        { id: 101, firstName: 'Claire', lastName: 'Martin', city: 'Lyon', postalCode: '69000' },
        { id: 102, firstName: 'Paul', lastName: 'Durand', city: 'Bordeaux', postalCode: '33000' },
      ],
      products: [
        {
          id: 101,
          name: 'T-Shirt Urban Noir',
          price: 19.9,
          purchasePrice: 8,
          tva: 20,
          categoryId: 101,
          supplierId: 101,
          brandId: 101,
          variationIds: [101, 102, 103, 104],
          stockByVariation: { '101': 5, '102': 8, '103': 4, '104': 6 },
          image: null,
        },
        {
          id: 102,
          name: 'Jeans DenimCo Bleu',
          price: 59.9,
          purchasePrice: 25,
          tva: 20,
          categoryId: 102,
          supplierId: 102,
          brandId: 102,
          stock: 15,
          image: null,
        },
        {
          id: 103,
          name: 'Casquette UrbanWear',
          price: 24.9,
          purchasePrice: 10,
          tva: 20,
          categoryId: 103,
          supplierId: 101,
          brandId: 101,
          stock: 12,
          image: null,
        },
      ],
      establishments: [
        {
          id: 3,
          name: 'Boutique Mode Centre',
          address: '8 place Bellecour',
          postalCode: '69002',
          city: 'Lyon',
          country: 'France',
          phone: '0404040404',
          email: 'centre@mode.test',
          siret: '98765432100017',
          naf: '4771Z',
          tvaNumber: 'FR48987654321',
        },
        {
          id: 4,
          name: 'Boutique Mode Atlantique',
          address: '15 quai des Chartrons',
          postalCode: '33000',
          city: 'Bordeaux',
          country: 'France',
          phone: '0505050505',
          email: 'atlantique@mode.test',
          siret: '98765432100025',
          naf: '4771Z',
          tvaNumber: 'FR48987654321',
        },
      ],
    },
  ]

  return db.transaction(async (tx) => {
    if (reset) {
      await resetDatabase(tx)
    }

    const summary: SeedResult = {
      categories: 0,
      suppliers: 0,
      brands: 0,
      variationGroups: 0,
      variations: 0,
      sellers: 0,
      customers: 0,
      products: 0,
    }

    for (const tenant of tenants) {
      console.log(`➡️  Insertion des données pour le tenant ${tenant.label} (${tenant.id})`)

      const insertedCategories = await tx
        .insert(categories)
        .values(tenant.categories.map(category => ({ ...category, tenantId: tenant.id })))
        .onConflictDoNothing({ target: categories.id })
        .returning({ id: categories.id })

      const insertedSuppliers = await tx
        .insert(suppliers)
        .values(tenant.suppliers.map(supplier => ({ ...supplier, tenantId: tenant.id })))
        .onConflictDoNothing({ target: suppliers.id })
        .returning({ id: suppliers.id })

      const insertedBrands = await tx
        .insert(brands)
        .values(tenant.brands.map(brand => ({ ...brand, tenantId: tenant.id })))
        .onConflictDoNothing({ target: brands.id })
        .returning({ id: brands.id })

      const insertedVariationGroups = await tx
        .insert(variationGroups)
        .values(tenant.variationGroups.map(group => ({ ...group, tenantId: tenant.id })))
        .onConflictDoNothing({ target: variationGroups.id })
        .returning({ id: variationGroups.id })

      const insertedVariations = await tx
        .insert(variations)
        .values(tenant.variations.map(variation => ({ ...variation, tenantId: tenant.id })))
        .onConflictDoNothing({ target: variations.id })
        .returning({ id: variations.id })

      const insertedSellers = await tx
        .insert(sellers)
        .values(tenant.sellers.map((seller, index) => ({
          ...seller,
          code: seller.code || `SLR-${String(index + 1).padStart(3, '0')}`,
          tenantId: tenant.id,
        })))
        .onConflictDoNothing({ target: sellers.id })
        .returning({ id: sellers.id })

      const insertedCustomers = await tx
        .insert(customers)
        .values(
          tenant.customers.map((customer) => ({
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: null,
            phone: null,
            address: null,
            metadata: {
              city: customer.city,
              postalCode: customer.postalCode,
            },
            gdprConsent: true,
            gdprConsentDate: new Date(),
            tenantId: tenant.id,
          })),
        )
        .onConflictDoNothing({ target: customers.id })
        .returning({ id: customers.id })

      const productPayloads = tenant.products.map((product) => {
        const p = product as Record<string, any>
        return {
          id: product.id,
          tenantId: tenant.id,
          name: product.name,
          barcode: p.barcode || null,
          price: product.price.toString(),
          purchasePrice: p.purchasePrice?.toString() || null,
          tva: product.tva?.toString() || '20',
          stock: p.stock ?? 0,
          stockByVariation: p.stockByVariation || null,
          minStock: 0,
          minStockByVariation: null,
          variationGroupIds: p.variationIds || null,
          categoryId: product.categoryId ?? null,
          supplierId: product.supplierId ?? null,
          brandId: product.brandId ?? null,
          image: product.image || null,
          description: null,
        }
      })

      const insertedProducts = await tx
        .insert(products)
        .values(productPayloads)
        .onConflictDoNothing({ target: products.id })
        .returning({ id: products.id })

      // Établissements
      const insertedEstablishments = await tx
        .insert(establishments)
        .values(
          tenant.establishments.map(est => ({
            ...est,
            tenantId: tenant.id,
            isActive: true,
          }))
        )
        .onConflictDoNothing({ target: establishments.id })
        .returning({ id: establishments.id })

      // Caisses : 2 par établissement
      const registerValues = tenant.establishments.flatMap(est => ([
        {
          tenantId: tenant.id,
          establishmentId: est.id,
          name: `${est.name} - Caisse 1`,
          isActive: true,
        },
        {
          tenantId: tenant.id,
          establishmentId: est.id,
          name: `${est.name} - Caisse 2`,
          isActive: true,
        },
      ]))

      const insertedRegisters = await tx
        .insert(registers)
        .values(registerValues)
        .returning({ id: registers.id })

      summary.categories += insertedCategories.length
      summary.suppliers += insertedSuppliers.length
      summary.brands += insertedBrands.length
      summary.variationGroups += insertedVariationGroups.length
      summary.variations += insertedVariations.length
      summary.sellers += insertedSellers.length
      summary.customers += insertedCustomers.length
      summary.products += insertedProducts.length

      console.log(`✅ Tenant ${tenant.label}: ${insertedEstablishments.length} établissements, ${insertedRegisters.length} caisses.`)
    }

    // Synchroniser les séquences PostgreSQL
    console.log('🔄 Synchronisation des séquences...')
    const tables = [
      'categories', 'suppliers', 'brands', 'variation_groups', 'variations',
      'sellers', 'customers', 'products', 'establishments', 'registers', 'sales', 'sale_items',
      'movements', 'stock_movements', 'closures', 'audit_logs', 'archives'
    ]

    for (const table of tables) {
      await tx.execute(sql`
        SELECT setval('${sql.raw(table + '_id_seq')}', COALESCE((SELECT MAX(id) FROM ${sql.raw(table)}), 1), true)
      `)
    }
    console.log('✅ Séquences synchronisées')

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
