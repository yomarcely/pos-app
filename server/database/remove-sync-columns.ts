import postgres from 'postgres'

const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'pos_app',
})

async function removeSyncColumns() {
  try {
    console.log('🔄 Suppression des colonnes de synchronisation obsolètes...')

    // Supprimer les colonnes de synchronisation de la table sales
    console.log('  - Suppression de sync_status...')
    await sql`ALTER TABLE sales DROP COLUMN IF EXISTS sync_status`

    console.log('  - Suppression de synced_at...')
    await sql`ALTER TABLE sales DROP COLUMN IF EXISTS synced_at`

    // Supprimer la table sync_queue si elle existe
    console.log('  - Suppression de la table sync_queue...')
    await sql`DROP TABLE IF EXISTS sync_queue`

    // Supprimer l'index sync_status s'il existe
    console.log('  - Suppression des index de synchronisation...')
    await sql`DROP INDEX IF EXISTS sales_sync_status_idx`
    await sql`DROP INDEX IF EXISTS sync_queue_status_idx`
    await sql`DROP INDEX IF EXISTS sync_queue_created_at_idx`

    console.log('✅ Colonnes de synchronisation supprimées avec succès!')

  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

removeSyncColumns()
