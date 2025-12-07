import { db } from './connection'
import { sql } from 'drizzle-orm'

async function migrate() {
  console.log('🔄 Migration: rendre audit_logs.entity_id nullable...')

  try {
    await db.execute(sql`
      ALTER TABLE audit_logs
      ALTER COLUMN entity_id DROP NOT NULL;
    `)

    console.log('✅ Colonne entity_id rendue nullable')
    console.log('🎉 Migration terminée avec succès !')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    process.exit(1)
  }
}

migrate()
