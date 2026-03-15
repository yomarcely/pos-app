import { db } from './connection'
import { sql } from 'drizzle-orm'

async function applyMigration() {
  try {
    console.log('📦 Application de la migration categories...')

    // 1. Créer la table categories
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        parent_id INTEGER REFERENCES categories(id),
        sort_order INTEGER DEFAULT 0,
        icon VARCHAR(50),
        color VARCHAR(20),
        is_archived BOOLEAN DEFAULT FALSE,
        archived_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `)
    console.log('✅ Table categories créée')

    // 2. Créer les index
    await db.execute(sql`CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories(parent_id)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS categories_name_idx ON categories(name)`)
    console.log('✅ Index créés')

    // 3. Ajouter la colonne à products
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id)`)
    console.log('✅ Colonne category_id ajoutée à products')

    // 4. Créer l'index
    await db.execute(sql`CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id)`)
    console.log('✅ Index products_category_id_idx créé')

    console.log('🎉 Migration terminée avec succès !')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    process.exit(1)
  }
}

applyMigration()
