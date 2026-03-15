// ⚠️ DANGER — DEV UNIQUEMENT
// Ce script supprime TOUTES les entrées de __drizzle_migrations.
// NE JAMAIS exécuter en production ou staging.
// Usage : uniquement pour réinitialiser une base de développement locale.
if (process.env.NODE_ENV === 'production') {
  throw new Error('reset-migrations ne peut pas s\'exécuter en production')
}

import postgres from 'postgres'

const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'pos_app',
})

async function resetMigrations() {
  try {
    console.log('🔄 Nettoyage de la table __drizzle_migrations...')

    // Supprimer toutes les entrées de migrations
    await sql`DELETE FROM drizzle.__drizzle_migrations`

    console.log('✅ Table __drizzle_migrations nettoyée avec succès')

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

resetMigrations()
