import { db } from './connection'
import { sql } from 'drizzle-orm'

/**
 * Migration: harmonisation du schéma des archives avec l'API
 */
async function migrate() {
  console.log('🔄 Migration: mise à jour du schéma archives...')

  try {
    // Période lisible
    await db.execute(sql`
      ALTER TABLE archives
      ADD COLUMN IF NOT EXISTS period varchar(20);
    `)
    await db.execute(sql`
      UPDATE archives
      SET period = COALESCE(period, to_char(period_start, 'YYYY-MM'));
    `)
    await db.execute(sql`
      ALTER TABLE archives
      ALTER COLUMN period SET NOT NULL;
    `)

    // Scope caisse
    await db.execute(sql`
      ALTER TABLE archives
      ADD COLUMN IF NOT EXISTS register_id integer;
    `)

    // Assouplir le stockage du fichier (inline possible)
    await db.execute(sql`
      ALTER TABLE archives
      ALTER COLUMN file_path DROP NOT NULL;
    `)

    // Hash & signature
    try {
      await db.execute(sql`
        ALTER TABLE archives
        RENAME COLUMN file_hash TO archive_hash;
      `)
    } catch (error: any) {
      if (!error?.message?.includes('column "file_hash" does not exist')) {
        throw error
      }
    }
    await db.execute(sql`
      ALTER TABLE archives
      ADD COLUMN IF NOT EXISTS archive_hash varchar(64);
    `)
    await db.execute(sql`
      ALTER TABLE archives
      ALTER COLUMN archive_hash SET NOT NULL;
    `)

    await db.execute(sql`
      ALTER TABLE archives
      ADD COLUMN IF NOT EXISTS archive_signature varchar(64);
    `)

    // Statistiques supplémentaires
    await db.execute(sql`
      ALTER TABLE archives
      ADD COLUMN IF NOT EXISTS closures_count integer DEFAULT 0;
    `)
    await db.execute(sql`
      UPDATE archives
      SET closures_count = 0
      WHERE closures_count IS NULL;
    `)
    await db.execute(sql`
      ALTER TABLE archives
      ALTER COLUMN closures_count SET NOT NULL;
    `)

    // Métadonnées libres
    await db.execute(sql`
      ALTER TABLE archives
      ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
    `)

    console.log('✅ Schéma archives mis à jour avec succès!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erreur lors de la migration archives:', error)
    process.exit(1)
  }
}

migrate()
