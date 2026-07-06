/**
 * Audit statique des migrations Drizzle (sans accès DB).
 *
 * Vérifie :
 * - Cohérence entre les fichiers SQL présents et le journal `meta/_journal.json`
 *   * Pas de fichier SQL orphelin (pas dans le journal)
 *   * Pas d'entrée journal sans fichier
 * - Pas de SQL syntaxiquement aberrant (parse basique : commande SQL valide attendue)
 *
 * Conçu pour CI : exit 1 sur la moindre incohérence.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(process.cwd(), 'server/database/migrations')
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta/_journal.json')

interface JournalEntry {
  idx: number
  tag: string
  when: number
}

interface Journal {
  version: string
  entries: JournalEntry[]
}

function listSqlFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => {
      const full = join(MIGRATIONS_DIR, f)
      return f.endsWith('.sql') && statSync(full).isFile()
    })
    .map(f => f.replace(/\.sql$/, ''))
    .sort()
}

function loadJournal(): Journal {
  const raw = readFileSync(JOURNAL_PATH, 'utf-8')
  return JSON.parse(raw) as Journal
}

function main() {
  const sqlFiles = new Set(listSqlFiles())
  const journal = loadJournal()
  const journalTags = new Set(journal.entries.map(e => e.tag))

  console.log(`\n📊 Audit migrations Drizzle\n`)
  console.log(`📁 Fichiers SQL sur disque : ${sqlFiles.size}`)
  console.log(`📜 Entrées dans _journal.json : ${journalTags.size}\n`)

  // 1. Fichiers orphelins (sur disque mais pas dans journal)
  // Depuis la baseline 2026-07-06 (chaîne rejouable de zéro), AUCUN fichier ad-hoc hors
  // journal n'est toléré — les anciens ad-hoc vivent dans migrations-archive/ (jamais audité).
  const KNOWN_ADHOC: string[] = []
  const orphanedFiles = [...sqlFiles].filter(f => !journalTags.has(f) && !KNOWN_ADHOC.includes(f))
  if (orphanedFiles.length > 0) {
    console.log('🔴 Fichiers SQL orphelins (pas dans _journal.json) :')
    for (const f of orphanedFiles) console.log(`  - ${f}.sql`)
    console.log('')
  }

  // 2. Entrées journal sans fichier
  const missingFiles = [...journalTags].filter(t => !sqlFiles.has(t))
  if (missingFiles.length > 0) {
    console.log('🔴 Entrées _journal.json sans fichier SQL correspondant :')
    for (const t of missingFiles) console.log(`  - ${t}.sql (manquant)`)
    console.log('')
  }

  // 3. Vérification basique du contenu : chaque fichier doit contenir au moins une commande SQL
  // Tolère les fichiers explicitement marqués NOOP (synchronisation journal sans changement schema)
  const malformedFiles: string[] = []
  for (const tag of sqlFiles) {
    const path = join(MIGRATIONS_DIR, `${tag}.sql`)
    const content = readFileSync(path, 'utf-8').trim()
    if (content.length === 0) {
      malformedFiles.push(`${tag}.sql (vide)`)
      continue
    }
    // Marqueur explicite NOOP — toléré
    if (/\b(NOOP|NO-?OP|noop)\b/i.test(content) || /toutes les tables existent déjà/.test(content)) {
      continue
    }
    if (!/\b(CREATE|ALTER|INSERT|UPDATE|DROP|DELETE)\b/i.test(content)) {
      malformedFiles.push(`${tag}.sql (aucune commande SQL standard détectée)`)
    }
  }
  if (malformedFiles.length > 0) {
    console.log('🟠 Fichiers SQL suspects :')
    for (const f of malformedFiles) console.log(`  - ${f}`)
    console.log('')
  }

  // 4. Ordre chronologique du journal (idx croissant)
  let lastIdx = -1
  let lastWhen = 0
  for (const entry of journal.entries) {
    if (entry.idx <= lastIdx) {
      console.log(`🔴 Désordre dans _journal.json : entry idx=${entry.idx} après idx=${lastIdx}`)
    }
    if (entry.when < lastWhen) {
      console.log(`🟠 Timestamp non croissant dans _journal.json : ${entry.tag} when=${entry.when} < précédent ${lastWhen}`)
    }
    lastIdx = entry.idx
    lastWhen = entry.when
  }

  // Verdict
  const errors = orphanedFiles.length + missingFiles.length + malformedFiles.length
  if (errors > 0) {
    console.log(`❌ ${errors} problème(s) détecté(s) — fail.\n`)
    process.exit(1)
  }
  console.log('✅ Migrations cohérentes.\n')
}

main()
