import { db } from './connection'
import { sql } from 'drizzle-orm'

async function applyMigration() {
  try {
    console.log('📦 Suppression de la colonne description de categories...')

    await db.execute(sql`ALTER TABLE categories DROP COLUMN IF EXISTS description`)

    console.log('✅ Colonne description supprimée')
    console.log('🎉 Migration terminée avec succès !')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    process.exit(1)
  }
}

applyMigration()
