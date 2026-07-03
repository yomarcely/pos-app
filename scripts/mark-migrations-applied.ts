/**
 * Amorçage d'une base VIERGE (bootstrap staging/prod).
 *
 * Contexte : la chaîne de migrations ne peut pas reconstruire une base de zéro
 * (le schéma initial a été créé via `drizzle-kit push` au début du projet — 22 tables
 * sur 32 n'ont aucun CREATE TABLE dans les fichiers de migration). La procédure
 * d'amorçage est donc : `pnpm db:push` (schéma complet depuis schema.ts) PUIS ce
 * script, qui marque toutes les migrations de meta/_journal.json comme appliquées
 * dans drizzle.__drizzle_migrations sans les exécuter. Les migrations FUTURES
 * s'appliqueront ensuite normalement via `pnpm db:migrate`.
 *
 * Garde-fous : exige RUN_BOOTSTRAP=1 ; refuse si le journal DB contient déjà des
 * lignes (base non vierge = utiliser repair-migrations.ts ou investiguer) ; refuse
 * si le schéma n'a pas été poussé (table `sales` absente).
 *
 * Usage : RUN_BOOTSTRAP=1 pnpm tsx scripts/mark-migrations-applied.ts
 */
import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const MIGRATIONS_DIR = join(process.cwd(), 'server/database/migrations')

interface JournalEntry { idx: number, tag: string, when: number }

async function main() {
  if (process.env.RUN_BOOTSTRAP !== '1') {
    console.error('❌ Sécurité : lancer avec RUN_BOOTSTRAP=1 (opération d\'amorçage uniquement).')
    process.exit(1)
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

  // Garde-fou 1 : le schéma doit avoir été poussé (pnpm db:push)
  const hasSales = await sql`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sales'`
  if (hasSales.length === 0) {
    console.error('❌ La table `sales` est absente : lancer `pnpm db:push` d\'abord.')
    await sql.end()
    process.exit(1)
  }

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
  await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`

  // Garde-fou 2 : journal vierge uniquement (sinon ce n'est pas un amorçage)
  const existing = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`
  const journalRows = Number(existing[0]?.n ?? 0)
  if (journalRows > 0) {
    console.error(`❌ Le journal contient déjà ${journalRows} ligne(s) : base non vierge, annulation.`)
    await sql.end()
    process.exit(1)
  }

  const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json')).toString()) as { entries: JournalEntry[] }

  await sql.begin(async (tx) => {
    for (const entry of journal.entries) {
      const content = readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`)).toString()
      const hash = createHash('sha256').update(content).digest('hex')
      await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`
      console.log(`📌 ${entry.tag} marquée appliquée`)
    }
  })

  console.log(`\n✅ ${journal.entries.length} migrations marquées. Vérifier avec : pnpm db:migrate (doit ne rien appliquer).`)
  await sql.end()
}

main().catch((err) => {
  console.error('Erreur :', err.message)
  process.exit(1)
})
