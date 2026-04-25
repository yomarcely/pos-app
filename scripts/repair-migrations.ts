/**
 * Répare le journal __drizzle_migrations désynchro avec l'état réel de la DB.
 *
 * Contexte : 0010 et 0011 ont été appliquées sur la DB (colonnes/tables présentes)
 * mais pas enregistrées dans __drizzle_migrations. Sans cette réparation,
 * `pnpm db:migrate` essaie de les ré-appliquer et échoue (`already exists`).
 *
 * Cas particulier 0010 : l'index `customers_email_tenant_unique` manque dans la DB
 * (probablement échec partiel à l'époque) — on le crée avant de marquer la migration
 * comme appliquée.
 *
 * Tout est dans une transaction. Read-only safe : le script ne s'exécute que si
 * les marqueurs des deux migrations sont déjà présents (sinon il refuse de marquer).
 */
import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const MIGRATIONS_DIR = join(process.cwd(), 'server/database/migrations')

function hashFile(name: string): string {
  const content = readFileSync(join(MIGRATIONS_DIR, name)).toString()
  return createHash('sha256').update(content).digest('hex')
}

const TARGETS = [
  { tag: '0010_striped_ares', when: 1774402257367 },
  { tag: '0011_striped_vermin', when: 1777021604243 },
]

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

  // Garde-fou : refuser de marquer si les marqueurs essentiels ne sont pas là
  const m0010 = await sql`SELECT 1 FROM information_schema.columns WHERE table_name='brands' AND column_name='created_by_establishment_id'`
  const m0011 = await sql`SELECT 1 FROM information_schema.tables WHERE table_name='pending_sales'`
  if (m0010.length === 0) {
    console.error('❌ Le marqueur 0010 (brands.created_by_establishment_id) est absent. La migration n\'a pas été appliquée. Annulation.')
    await sql.end()
    process.exit(1)
  }
  if (m0011.length === 0) {
    console.error('❌ Le marqueur 0011 (table pending_sales) est absent. La migration n\'a pas été appliquée. Annulation.')
    await sql.end()
    process.exit(1)
  }

  // Vérifier l'état du journal
  const applied = await sql<{ hash: string }[]>`
    SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id ASC
  `
  const appliedHashes = new Set(applied.map(r => r.hash))

  console.log(`📊 Journal actuel : ${applied.length} migrations enregistrées`)

  await sql.begin(async (tx) => {
    // Cas particulier 0010 : créer l'index manquant si absent
    const idxRows = await tx`SELECT 1 FROM pg_indexes WHERE indexname='customers_email_tenant_unique'`
    if (idxRows.length === 0) {
      console.log('🔧 Création de l\'index manquant customers_email_tenant_unique')
      await tx.unsafe('CREATE UNIQUE INDEX "customers_email_tenant_unique" ON "customers" USING btree ("email","tenant_id")')
    }
    else {
      console.log('✅ Index customers_email_tenant_unique déjà présent')
    }

    for (const target of TARGETS) {
      const hash = hashFile(`${target.tag}.sql`)
      if (appliedHashes.has(hash)) {
        console.log(`✅ ${target.tag} déjà enregistrée`)
        continue
      }
      console.log(`📌 Marque ${target.tag} comme appliquée (hash=${hash.substring(0, 16)}…)`)
      await tx`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${target.when})
      `
    }
  })

  console.log('\n✅ Journal réparé. Lance maintenant : pnpm db:migrate')
  await sql.end()
}

main().catch((err) => {
  console.error('Erreur :', err.message)
  process.exit(1)
})
