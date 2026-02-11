import postgres from 'postgres'

const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'pos_app',
})

async function syncSchema() {
  try {
    console.log('🔄 Synchronisation du schéma de base de données...')

    // Ajouter les colonnes manquantes dans products
    console.log('📝 Ajout des colonnes manquantes dans products...')

    await sql`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS barcode_by_variation jsonb,
      ADD COLUMN IF NOT EXISTS supplier_id integer,
      ADD COLUMN IF NOT EXISTS brand_id integer,
      ADD COLUMN IF NOT EXISTS supplier_code varchar(100),
      ADD COLUMN IF NOT EXISTS min_stock integer DEFAULT 5,
      ADD COLUMN IF NOT EXISTS min_stock_by_variation jsonb
    `

    // Ajouter la colonne original_price dans sale_items
    console.log('📝 Ajout de la colonne original_price dans sale_items...')
    await sql`
      ALTER TABLE sale_items
      ADD COLUMN IF NOT EXISTS original_price numeric(10, 2)
    `

    // Ajouter les foreign keys manquantes (ignorer si elles existent déjà)
    console.log('🔗 Ajout des clés étrangères...')

    try {
      await sql`
        ALTER TABLE products
        ADD CONSTRAINT products_category_id_categories_id_fk
        FOREIGN KEY (category_id) REFERENCES categories(id)
      `
    } catch (e) {
      if (!(e instanceof Error) || !e.message?.includes('already exists')) throw e
    }

    try {
      await sql`
        ALTER TABLE products
        ADD CONSTRAINT products_supplier_id_suppliers_id_fk
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      `
    } catch (e) {
      if (!(e instanceof Error) || !e.message?.includes('already exists')) throw e
    }

    try {
      await sql`
        ALTER TABLE products
        ADD CONSTRAINT products_brand_id_brands_id_fk
        FOREIGN KEY (brand_id) REFERENCES brands(id)
      `
    } catch (e) {
      if (!(e instanceof Error) || !e.message?.includes('already exists')) throw e
    }

    try {
      await sql`
        ALTER TABLE sales
        ADD CONSTRAINT sales_closure_id_closures_id_fk
        FOREIGN KEY (closure_id) REFERENCES closures(id)
      `
    } catch (e) {
      if (!(e instanceof Error) || !e.message?.includes('already exists')) throw e
    }

    try {
      await sql`
        ALTER TABLE stock_movements
        ADD CONSTRAINT stock_movements_movement_id_movements_id_fk
        FOREIGN KEY (movement_id) REFERENCES movements(id) ON DELETE CASCADE
      `
    } catch (e) {
      if (!(e instanceof Error) || !e.message?.includes('already exists')) throw e
    }

    try {
      await sql`
        ALTER TABLE variations
        ADD CONSTRAINT variations_group_id_variation_groups_id_fk
        FOREIGN KEY (group_id) REFERENCES variation_groups(id) ON DELETE CASCADE
      `
    } catch (e) {
      if (!(e instanceof Error) || !e.message?.includes('already exists')) throw e
    }

    // Créer les index manquants
    console.log('📇 Création des index manquants...')

    await sql`CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id)`
    await sql`CREATE INDEX IF NOT EXISTS products_supplier_id_idx ON products(supplier_id)`
    await sql`CREATE INDEX IF NOT EXISTS products_brand_id_idx ON products(brand_id)`
    await sql`CREATE INDEX IF NOT EXISTS sales_closure_id_idx ON sales(closure_id)`
    await sql`CREATE INDEX IF NOT EXISTS stock_movements_movement_id_idx ON stock_movements(movement_id)`
    await sql`CREATE INDEX IF NOT EXISTS movements_type_idx ON movements(type)`
    await sql`CREATE INDEX IF NOT EXISTS movements_created_at_idx ON movements(created_at)`
    await sql`CREATE INDEX IF NOT EXISTS movements_movement_number_idx ON movements(movement_number)`

    console.log('✅ Schéma synchronisé avec succès!')

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

syncSchema()
