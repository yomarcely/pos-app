/**
 * Bascule d'une base EXISTANTE vers la chaîne baseline (2026-07-06).
 *
 * Contexte : la chaîne de migrations a été remplacée par une baseline unique
 * (`server/database/migrations/0000_baseline.sql`, générée depuis schema.ts) — l'ancienne
 * chaîne est archivée dans `server/database/migrations-archive/` (voir son README).
 *
 * - Base VIERGE : ce script est INUTILE — `pnpm db:migrate` suffit désormais.
 * - Base EXISTANTE (dev/staging/prod) : elle possède déjà le schéma, la baseline ne doit
 *   JAMAIS y être exécutée. Ce script remplace le contenu de `drizzle.__drizzle_migrations`
 *   (journal de l'ancienne chaîne) par les entrées de la nouvelle chaîne marquées appliquées.
 *   Les migrations FUTURES (0001+) s'appliqueront ensuite normalement via `pnpm db:migrate`.
 *
 * Garde-fous : exige RUN_BASELINE_SWITCH=1 ; refuse si le schéma est absent (table `sales`
 * manquante = base vierge → utiliser `pnpm db:migrate`).
 *
 * Usage : RUN_BASELINE_SWITCH=1 pnpm tsx scripts/mark-migrations-applied.ts
 * Vérification ensuite : `pnpm db:migrate` ne doit rien appliquer.
 */
import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const MIGRATIONS_DIR = join(process.cwd(), 'server/database/migrations')

interface JournalEntry { idx: number, tag: string, when: number }

async function main() {
  if (process.env.RUN_BASELINE_SWITCH !== '1') {
    console.error('❌ Sécurité : lancer avec RUN_BASELINE_SWITCH=1 (bascule de bases existantes uniquement).')
    console.error('   Base vierge ? Utiliser directement : pnpm db:migrate')
    process.exit(1)
  }

  const url = (process.env.DATABASE_URL || '').trim()
  if (!url) {
    console.error('❌ DATABASE_URL absente.')
    process.exit(1)
  }
  console.log(`🎯 Cible : ${new URL(url).hostname}`)

  const sql = postgres(url, { max: 1 })

  // Garde-fou : le schéma doit exister (sinon base vierge → pnpm db:migrate, pas ce script)
  const hasSales = await sql`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sales'`
  if (hasSales.length === 0) {
    console.error('❌ La table `sales` est absente : base vierge → utiliser `pnpm db:migrate` (ce script ne sert qu\'aux bases existantes).')
    await sql.end()
    process.exit(1)
  }

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
  await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`

  const existing = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`
  const oldRows = Number(existing[0]?.n ?? 0)

  const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json')).toString()) as { entries: JournalEntry[] }

  await sql.begin(async (tx) => {
    if (oldRows > 0) {
      await tx`DELETE FROM drizzle.__drizzle_migrations`
      console.log(`🧹 Ancien journal purgé (${oldRows} ligne(s) de l'ancienne chaîne).`)
    }
    for (const entry of journal.entries) {
      const content = readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`)).toString()
      const hash = createHash('sha256').update(content).digest('hex')
      await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`
      console.log(`📌 ${entry.tag} marquée appliquée`)
    }
  })

  console.log(`\n✅ Journal basculé sur la nouvelle chaîne (${journal.entries.length} entrée(s)). Vérifier avec : pnpm db:migrate (doit ne rien appliquer).`)
  await sql.end()
}

main().catch((err) => {
  console.error('Erreur :', err.message)
  process.exit(1)
})
