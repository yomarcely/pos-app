// server/api/database/seed.post.ts
import { eq } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { sellers, products, customers } from '~/server/database/schema'
import sellersData from '../../../public/mock/sellers.json'
import productsData from '../../../public/mock/products.json'
import customersData from '../../../public/mock/customers.json'

/**
 * ==========================================
 * API: Seed database with mock data
 * ==========================================
 *
 * POST /api/database/seed
 *
 * Peuple la base de données avec les données de vendeurs et produits
 */

export default defineEventHandler(async (event) => {
  try {
    console.log('🌱 Démarrage du seed de la base de données...')

    const results = {
      sellers: { added: 0, existing: 0 },
      products: { added: 0, existing: 0 },
      customers: { added: 0, existing: 0 },
    }

    // 1. Seed des vendeurs
    console.log('📝 Insertion des vendeurs...')

    for (const seller of sellersData) {
      const existing = await db
        .select()
        .from(sellers)
        .where(eq(sellers.id, seller.id))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(sellers).values({
          id: seller.id,
          name: seller.name,
          email: `${seller.name.toLowerCase()}@example.com`,
          isActive: true,
        })
        console.log(`  ✅ Vendeur ajouté: ${seller.name}`)
        results.sellers.added++
      } else {
        console.log(`  ⏭️  Vendeur déjà existant: ${seller.name}`)
        results.sellers.existing++
      }
    }

    // 2. Seed des produits
    console.log('📦 Insertion des produits...')

    for (const product of productsData) {
      const existing = await db
        .select()
        .from(products)
        .where(eq(products.id, product.id))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(products).values({
          id: product.id,
          name: product.name,
          barcode: product.barcode || null,
          price: product.price.toString(),
          purchasePrice: product.purchasePrice?.toString() || null,
          tva: product.tva || 20,
          stock: product.stock || null,
          stockByVariation: product.stockByVariation
            ? JSON.stringify(product.stockByVariation)
            : null,
          variationGroupIds: product.variationGroupIds
            ? JSON.stringify(product.variationGroupIds)
            : null,
          image: product.image || null,
          category: product.category || null,
          isActive: true,
        })
        console.log(`  ✅ Produit ajouté: ${product.name}`)
        results.products.added++
      } else {
        console.log(`  ⏭️  Produit déjà existant: ${product.name}`)
        results.products.existing++
      }
    }

    // 3. Seed des clients
    console.log('👥 Insertion des clients...')

    for (const customer of customersData) {
      const existing = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customer.id))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(customers).values({
          id: customer.id,
          firstName: customer.name,
          lastName: customer.lastname,
          address: customer.address || null,
          phone: customer.phonenumber?.toString() || null,
          email: customer.mail || null,
          gdprConsent: true,
          gdprConsentDate: new Date(),
          marketingConsent: customer.authorizemailing || false,
        })
        console.log(`  ✅ Client ajouté: ${customer.name} ${customer.lastname}`)
        results.customers.added++
      } else {
        console.log(`  ⏭️  Client déjà existant: ${customer.name} ${customer.lastname}`)
        results.customers.existing++
      }
    }

    console.log('✨ Seed terminé avec succès!')

    return {
      success: true,
      message: 'Base de données seedée avec succès',
      results,
    }
  } catch (error: any) {
    console.error('❌ Erreur lors du seed:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors du seed de la base de données',
      message: error.message,
    })
  }
})
