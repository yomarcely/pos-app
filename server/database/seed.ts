// server/database/seed.ts
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, closeConnection } from './connection'
import { sellers, products } from './schema'
import sellersData from '../../public/mock/sellers.json' assert { type: 'json' }
import productsData from '../../public/mock/products.json' assert { type: 'json' }

/**
 * Script de seed pour la base de données
 * Peuple les tables sellers et products avec les données mock
 */
export async function seedDatabase() {
  console.log('🌱 Démarrage du seed de la base de données...')

  try {
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
          email: `${seller.name.toLowerCase()}@example.com`, // Email par défaut
          isActive: true,
        })
        console.log(`  ✅ Vendeur ajouté: ${seller.name}`)
      } else {
        console.log(`  ⏭️  Vendeur déjà existant: ${seller.name}`)
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
      } else {
        console.log(`  ⏭️  Produit déjà existant: ${product.name}`)
      }
    }

    console.log('✨ Seed terminé avec succès!')
    console.log(`📊 Résumé:`)
    console.log(`   - Vendeurs: ${sellersData.length}`)
    console.log(`   - Produits: ${productsData.length}`)

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error)
    throw error
  }
}

// Permet d'exécuter le script directement
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
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
