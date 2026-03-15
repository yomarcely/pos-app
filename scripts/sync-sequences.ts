import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db, closeConnection } from '../server/database/connection'

/**
 * Script pour synchroniser les séquences PostgreSQL après un seed
 * Cela corrige les erreurs "duplicate key value violates unique constraint"
 */

async function syncSequences() {
  console.log('🔄 Synchronisation des séquences PostgreSQL...')

  try {
    // Liste des tables avec des séquences serial
    const tables = [
      'categories',
      'suppliers',
      'brands',
      'variation_groups',
      'variations',
      'sellers',
      'customers',
      'products',
      'sales',
      'sale_items',
      'movements',
      'stock_movements',
      'closures',
      'audit_logs',
      'archives'
    ]

    for (const table of tables) {
      const sequenceName = `${table}_id_seq`

      // Synchroniser la séquence avec la valeur max actuelle de la table
      await db.execute(sql.raw(`
        SELECT setval('${sequenceName}', COALESCE((SELECT MAX(id) FROM ${table}), 1), true)
      `))

      console.log(`✅ Séquence synchronisée: ${sequenceName}`)
    }

    console.log('✅ Toutes les séquences ont été synchronisées')
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation des séquences:', error)
    throw error
  } finally {
    await closeConnection()
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  syncSequences()
}

export { syncSequences }
