import { db } from './connection'
import { sql } from 'drizzle-orm'

async function applyMigration() {
  try {
    console.log('📦 Application de la migration closures...')

    // 1. Créer la table closures
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS closures (
        id SERIAL PRIMARY KEY,
        closure_date VARCHAR(10) NOT NULL,
        ticket_count INTEGER NOT NULL DEFAULT 0,
        cancelled_count INTEGER NOT NULL DEFAULT 0,
        total_ht DECIMAL(12, 2) NOT NULL,
        total_tva DECIMAL(12, 2) NOT NULL,
        total_ttc DECIMAL(12, 2) NOT NULL,
        payment_methods JSONB NOT NULL,
        closure_hash VARCHAR(64) NOT NULL UNIQUE,
        first_ticket_number VARCHAR(50),
        last_ticket_number VARCHAR(50),
        last_ticket_hash VARCHAR(64),
        closed_by VARCHAR(100),
        closed_by_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `)
    console.log('✅ Table closures créée')

    // 2. Créer les index
    await db.execute(sql`CREATE INDEX IF NOT EXISTS closures_closure_date_idx ON closures(closure_date)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS closures_closure_hash_idx ON closures(closure_hash)`)
    console.log('✅ Index créés')

    // 3. Ajouter les colonnes à sales
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS closure_id INTEGER REFERENCES closures(id)`)
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE`)
    console.log('✅ Colonnes ajoutées à sales')

    // 4. Créer l'index
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sales_closure_id_idx ON sales(closure_id)`)
    console.log('✅ Index sales_closure_id_idx créé')

    console.log('🎉 Migration terminée avec succès !')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    process.exit(1)
  }
}

applyMigration()
