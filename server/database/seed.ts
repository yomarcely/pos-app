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
  taxRates,
  productStocks,
  productEstablishments,
  customerEstablishments,
  syncGroups,
  syncGroupEstablishments,
  syncRules,
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
  taxRatesSeed,
} from './seed-data'

type SeedOptions = {
  reset?: boolean
  tenantId?: string
}

type SeedResult = {
  taxRates: number
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
      product_stocks,
      product_establishments,
      customer_establishments,
      sync_logs,
      sync_rules,
      sync_group_establishments,
      sync_groups,
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
      tax_rates,
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
        {
          id: 3,
          name: 'Vape Shop Ouest',
          address: '28 quai de la Fosse',
          postalCode: '44000',
          city: 'Nantes',
          country: 'France',
          phone: '0240506070',
          email: 'ouest@vapecentre.test',
          siret: '12345678900037',
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
          id: 4,
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
          id: 5,
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
    {
      id: 'c4e7b3f5-9a21-4d8c-b6e3-1f5a8c9d2e4b',
      label: 'Librairie',
      categories: [
        { id: 201, name: 'Romans' },
        { id: 202, name: 'Science-Fiction' },
        { id: 203, name: 'BD & Mangas' },
        { id: 204, name: 'Jeunesse' },
        { id: 205, name: 'Essais' },
      ],
      suppliers: [
        { id: 201, name: 'Éditions Gallimard', email: 'contact@gallimard.test', phone: '0601010101' },
        { id: 202, name: 'Hachette Livre', email: 'info@hachette.test', phone: '0602020202' },
        { id: 203, name: 'Glenat', email: 'ventes@glenat.test', phone: '0603030303' },
      ],
      brands: [
        { id: 201, name: 'Folio' },
        { id: 202, name: 'Pocket' },
        { id: 203, name: 'Glénat Manga' },
      ],
      variationGroups: [
        { id: 201, name: 'Format' },
      ],
      variations: [
        { id: 201, groupId: 201, name: 'Poche', sortOrder: 1 },
        { id: 202, groupId: 201, name: 'Broché', sortOrder: 2 },
        { id: 203, groupId: 201, name: 'Relié', sortOrder: 3 },
      ],
      sellers: [
        { id: 201, name: 'Sophie', code: 'SLR-201' },
        { id: 202, name: 'Thomas', code: 'SLR-202' },
        { id: 203, name: 'Emma', code: 'SLR-203' },
      ],
      customers: [
        { id: 201, firstName: 'Julie', lastName: 'Rousseau', city: 'Toulouse', postalCode: '31000' },
        { id: 202, firstName: 'Marc', lastName: 'Lefebvre', city: 'Lille', postalCode: '59000' },
        { id: 203, firstName: 'Isabelle', lastName: 'Bernard', city: 'Nantes', postalCode: '44000' },
        { id: 204, firstName: 'Pierre', lastName: 'Moreau', city: 'Strasbourg', postalCode: '67000' },
      ],
      products: [
        {
          id: 201,
          name: 'Le Seigneur des Anneaux - Intégrale',
          price: 29.90,
          purchasePrice: 15,
          tva: 5.5,
          categoryId: 201,
          supplierId: 201,
          brandId: 201,
          stock: 25,
          barcode: '9782070612888',
          image: null,
        },
        {
          id: 202,
          name: 'Fondation - Isaac Asimov',
          price: 8.50,
          purchasePrice: 4.25,
          tva: 5.5,
          categoryId: 202,
          supplierId: 202,
          brandId: 202,
          stock: 40,
          barcode: '9782070415335',
          image: null,
        },
        {
          id: 203,
          name: 'One Piece - Tome 1',
          price: 6.90,
          purchasePrice: 3.50,
          tva: 5.5,
          categoryId: 203,
          supplierId: 203,
          brandId: 203,
          stock: 60,
          barcode: '9782723434485',
          image: null,
        },
        {
          id: 204,
          name: 'Harry Potter - Coffret 7 tomes',
          price: 79.90,
          purchasePrice: 45,
          tva: 5.5,
          categoryId: 204,
          supplierId: 201,
          brandId: 201,
          variationIds: [201, 202, 203],
          stockByVariation: { '201': 8, '202': 12, '203': 5 },
          barcode: '9782070643028',
          image: null,
        },
        {
          id: 205,
          name: 'Sapiens - Yuval Noah Harari',
          price: 24.00,
          purchasePrice: 12,
          tva: 5.5,
          categoryId: 205,
          supplierId: 202,
          brandId: 201,
          stock: 30,
          barcode: '9782226257017',
          image: null,
        },
        {
          id: 206,
          name: 'Naruto - Coffret Intégral',
          price: 149.90,
          purchasePrice: 80,
          tva: 5.5,
          categoryId: 203,
          supplierId: 203,
          brandId: 203,
          stock: 10,
          barcode: '9782505064923',
          image: null,
        },
        {
          id: 207,
          name: 'Le Petit Prince',
          price: 5.90,
          purchasePrice: 2.50,
          tva: 5.5,
          categoryId: 204,
          supplierId: 201,
          brandId: 201,
          stock: 100,
          barcode: '9782070612758',
          image: null,
        },
      ],
      establishments: [
        {
          id: 6,
          name: 'Librairie du Capitole',
          address: '22 rue du Taur',
          postalCode: '31000',
          city: 'Toulouse',
          country: 'France',
          phone: '0606060606',
          email: 'capitole@librairie.test',
          siret: '45678912300018',
          naf: '4761Z',
          tvaNumber: 'FR48456789123',
        },
        {
          id: 7,
          name: 'Librairie des Flandres',
          address: '18 rue de Béthune',
          postalCode: '59000',
          city: 'Lille',
          country: 'France',
          phone: '0707070707',
          email: 'flandres@librairie.test',
          siret: '45678912300026',
          naf: '4761Z',
          tvaNumber: 'FR48456789123',
        },
        {
          id: 8,
          name: 'Librairie Atlantique',
          address: '9 place du Commerce',
          postalCode: '44000',
          city: 'Nantes',
          country: 'France',
          phone: '0808080808',
          email: 'atlantique@librairie.test',
          siret: '45678912300034',
          naf: '4761Z',
          tvaNumber: 'FR48456789123',
        },
      ],
    },
  ]

  return db.transaction(async (tx) => {
    if (reset) {
      await resetDatabase(tx)
    }

    const summary: SeedResult = {
      taxRates: 0,
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

      // Insérer les taux de TVA (communs à tous les tenants français)
      const insertedTaxRates = await tx
        .insert(taxRates)
        .values(taxRatesSeed.map(taxRate => ({
          ...taxRate,
          rate: taxRate.rate.toString(),
          tenantId: tenant.id
        })))
        .onConflictDoNothing({ target: taxRates.id })
        .returning({ id: taxRates.id })

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

      summary.taxRates += insertedTaxRates.length
      summary.categories += insertedCategories.length
      summary.suppliers += insertedSuppliers.length
      summary.brands += insertedBrands.length
      summary.variationGroups += insertedVariationGroups.length
      summary.variations += insertedVariations.length
      summary.sellers += insertedSellers.length
      summary.customers += insertedCustomers.length
      summary.products += insertedProducts.length

      // Paramètres produits par établissement (prix locaux, dispo)
      // IMPORTANT : Ne créer les liaisons QUE pour les 2 premiers établissements
      // Le 3ème établissement sera isolé (pas de produits/clients au départ)
      const establishmentsWithData = tenant.establishments.slice(0, 2)

      const productEstablishmentValues = establishmentsWithData.flatMap(est =>
        insertedProducts.map(({ id }) => ({
          tenantId: tenant.id,
          productId: id,
          establishmentId: est.id,
          priceOverride: null,
          purchasePriceOverride: null,
          isAvailable: true,
          notes: null,
        }))
      )

      if (productEstablishmentValues.length > 0) {
        await tx.insert(productEstablishments).values(productEstablishmentValues)
      }

      // Liaison clients / établissements
      const customerEstablishmentValues = establishmentsWithData.flatMap(est =>
        insertedCustomers.map(({ id }) => ({
          tenantId: tenant.id,
          customerId: id,
          establishmentId: est.id,
          localDiscount: null,
          localNotes: null,
          localLoyaltyPoints: 0,
          firstPurchaseDate: null,
          lastPurchaseDate: null,
          totalPurchases: '0',
          purchaseCount: 0,
        }))
      )

      if (customerEstablishmentValues.length > 0) {
        await tx.insert(customerEstablishments).values(customerEstablishmentValues)
      }

      // Stock par établissement : répartir le stock existant UNIQUEMENT sur les 2 premiers établissements
      const productById = new Map(tenant.products.map(p => [p.id, p]))
      const weightsFor = (total: number) => {
        if (total <= 1) return [1]
        if (total === 2) return [0.7, 0.3]
        if (total === 3) return [0.5, 0.3, 0.2]
        const first = 0.4
        const remaining = 0.6
        const rest = remaining / (total - 1)
        return [first, ...Array.from({ length: total - 1 }, () => rest)]
      }
      const allocate = (total: number, estIndex: number, totalEstabs: number, weights: number[]) => {
        if (total <= 0) return 0
        const weight = weights[estIndex] ?? (1 / totalEstabs)
        const floorValue = Math.floor(total * weight)
        if (estIndex === totalEstabs - 1) {
          const distributed = weights
            .slice(0, estIndex)
            .reduce((sum, _w, idx) => sum + Math.floor(total * (weights[idx] ?? 0)), 0)
          return Math.max(0, total - distributed)
        }
        return Math.max(0, floorValue)
      }

      const stockValues = establishmentsWithData.flatMap((est, estIndex) =>
        insertedProducts.map(({ id }) => {
          const original = productById.get(id) as any
          const totalEstabs = establishmentsWithData.length || 1
          const baseStock = Number(original?.stock ?? 0)
          const weights = weightsFor(totalEstabs)
          const distributedStock = allocate(baseStock, estIndex, totalEstabs, weights)

          let stockByVariation: Record<string, number> | null = null
          if (original?.stockByVariation) {
            const varWeights = weightsFor(totalEstabs)
            stockByVariation = Object.fromEntries(
              Object.entries(original.stockByVariation).map(([variationId, stockValue]) => {
                const total = Number(stockValue ?? 0)
                const perEst = allocate(total, estIndex, totalEstabs, varWeights)
                return [variationId, perEst]
              })
            )
          }

          return {
            tenantId: tenant.id,
            productId: id,
            establishmentId: est.id,
            stock: stockByVariation ? null : distributedStock,
            stockByVariation: stockByVariation ?? null,
            minStock: 5,
            minStockByVariation: null,
          }
        })
      )

      if (stockValues.length > 0) {
        await tx.insert(productStocks).values(stockValues)
      }

      // Créer un groupe de synchronisation par défaut pour le tenant principal
      // Mise en situation : synchroniser les produits et clients entre les deux premiers établissements seulement
      if (tenant.establishments.length >= 2) {
        const [est1, est2] = tenant.establishments

        // Insérer le groupe
        const [insertedGroup] = await tx
          .insert(syncGroups)
          .values({
            name: `${tenant.label} - Groupe Sync Démo`,
            description: 'Synchronisation démo entre les deux premiers établissements',
            tenantId: tenant.id,
          })
          .returning({ id: syncGroups.id })

        // Lier uniquement les 2 premiers établissements au groupe de synchronisation
        await tx.insert(syncGroupEstablishments).values([
          {
            syncGroupId: insertedGroup.id,
            establishmentId: est1.id,
            tenantId: tenant.id,
          },
          {
            syncGroupId: insertedGroup.id,
            establishmentId: est2.id,
            tenantId: tenant.id,
          },
        ])

        // Règles produits (groupe)
        await tx.insert(syncRules).values({
          syncGroupId: insertedGroup.id,
          entityType: 'product',
          syncName: true,
          syncDescription: true,
          syncBarcode: true,
          syncCategory: true,
          syncSupplier: true,
          syncBrand: true,
          syncPriceHt: true,
          syncPriceTtc: false, // prix local par établissement
          syncTva: true,
          syncImage: true,
          syncVariations: true,
          tenantId: tenant.id,
        })

        // Règles clients (groupe)
        await tx.insert(syncRules).values({
          syncGroupId: insertedGroup.id,
          entityType: 'customer',
          syncCustomerInfo: true,
          syncCustomerContact: true,
          syncCustomerAddress: true,
          syncCustomerGdpr: true,
          syncLoyaltyProgram: false,
          syncDiscount: false,
          tenantId: tenant.id,
        })

        console.log(`🔗 Groupe de synchronisation démo créé pour ${tenant.label} (ID ${insertedGroup.id})`)
      }

      console.log(`✅ Tenant ${tenant.label}: ${insertedTaxRates.length} taux de TVA, ${insertedEstablishments.length} établissements, ${insertedRegisters.length} caisses.`)
    }

    // Synchroniser les séquences PostgreSQL
    console.log('🔄 Synchronisation des séquences...')
    const tables = [
      'tax_rates', 'categories', 'suppliers', 'brands', 'variation_groups', 'variations',
      'sellers', 'customers', 'products', 'product_stocks', 'product_establishments', 'customer_establishments', 'establishments', 'registers', 'sales', 'sale_items',
      'movements', 'stock_movements', 'closures', 'audit_logs', 'archives',
      'sync_groups', 'sync_group_establishments', 'sync_rules', 'sync_logs'
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
