/**
 * Lit l'état actuel du journal de migrations Drizzle (`__drizzle_migrations`)
 * et compare avec les fichiers SQL présents sur disque.
 * Read-only : ne modifie rien.
 */
import 'dotenv/config'
import postgres from 'postgres'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL manquante')

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 })

  // 1. Migrations enregistrées par Drizzle (ordre chronologique)
  const applied = await sql<{ id: number, hash: string, created_at: bigint }[]>`
    SELECT id, hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY id ASC
  `.catch(() => [])

  console.log('\n📜 Migrations enregistrées dans __drizzle_migrations :')
  if (applied.length === 0) {
    console.log('  (aucune)')
  }
  for (const row of applied) {
    const date = new Date(Number(row.created_at)).toISOString()
    console.log(`  #${row.id} hash=${row.hash.substring(0, 16)}… appliquée le ${date}`)
  }

  // 2. Fichiers SQL sur disque
  const dir = join(process.cwd(), 'server/database/migrations')
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  console.log(`\n📁 Fichiers SQL sur disque (${files.length}) :`)
  for (const file of files) {
    console.log(`  ${file}`)
  }

  // 3. Sondages d'existence sur les colonnes/tables récentes
  console.log('\n🔍 Sondages d\'état réel :')
  const probes = [
    { name: 'customer_establishments.first_name_override', q: sql`SELECT column_name FROM information_schema.columns WHERE table_name='customer_establishments' AND column_name='first_name_override'` },
    { name: 'customer_establishments.local_loyalty_points', q: sql`SELECT column_name FROM information_schema.columns WHERE table_name='customer_establishments' AND column_name='local_loyalty_points'` },
    { name: 'sales.points_earned (D2 — devrait être absent)', q: sql`SELECT column_name FROM information_schema.columns WHERE table_name='sales' AND column_name='points_earned'` },
    { name: 'loyalty_config (table D2)', q: sql`SELECT table_name FROM information_schema.tables WHERE table_name='loyalty_config'` },
    { name: 'loyalty_vouchers (table D2)', q: sql`SELECT table_name FROM information_schema.tables WHERE table_name='loyalty_vouchers'` },
  ]
  for (const probe of probes) {
    const rows = await probe.q
    console.log(`  ${probe.name}: ${rows.length > 0 ? '✅ existe' : '❌ absent'}`)
  }

  await sql.end()
}

main().catch((err) => {
  console.error('Erreur :', err.message)
  process.exit(1)
})
