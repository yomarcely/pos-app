import { db } from './connection'
import { sql } from 'drizzle-orm'

async function applyMigration() {
  try {
    console.log('📦 Application de la migration variations...')

    // 1. Créer la table variation_groups
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS variation_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        is_archived BOOLEAN DEFAULT FALSE,
        archived_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `)
    console.log('✅ Table variation_groups créée')

    // 2. Créer les index pour variation_groups
    await db.execute(sql`CREATE INDEX IF NOT EXISTS variation_groups_name_idx ON variation_groups(name)`)
    console.log('✅ Index variation_groups_name_idx créé')

    // 3. Créer la table variations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS variations (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES variation_groups(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_archived BOOLEAN DEFAULT FALSE,
        archived_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `)
    console.log('✅ Table variations créée')

    // 4. Créer les index pour variations
    await db.execute(sql`CREATE INDEX IF NOT EXISTS variations_group_id_idx ON variations(group_id)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS variations_name_idx ON variations(name)`)
    console.log('✅ Index créés pour variations')

    console.log('🎉 Migration terminée avec succès !')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    process.exit(1)
  }
}

applyMigration()
