/**
 * Audit statique : vérifie l'isolation multi-tenant sur tous les endpoints API.
 *
 * Pour chaque fichier server/api/**\/*.ts (sauf endpoints publics) :
 * - DOIT importer/appeler `getTenantIdFromEvent(event)` (lève 401 si tenant absent)
 * - DOIT utiliser `tenantId` dans au moins une WHERE clause Drizzle (eq/and/...)
 * - NE DOIT PAS lire `event.context.auth.tenantId` directement (anti-pattern)
 *
 * Sortie : liste des endpoints conformes / suspects / publics. Exit 1 si violations critiques.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(process.cwd(), 'server/api')
const REPO_ROOT = process.cwd()

// Endpoints publics intentionnels (= pas de tenant requis).
// Doit matcher PUBLIC_ENDPOINTS dans server/middleware/auth.global.ts + cas connus.
const KNOWN_PUBLIC = [
  'login',
  'auth',
  'database/seed', // dev seulement
]

// Fichiers exclus de l'audit (exemples tiers, code de wizard, etc.)
const EXCLUDED = [
  'sentry-example-api', // ajouté par le wizard Sentry, pas notre code
]

interface AuditResult {
  path: string
  hasTenantImport: boolean
  hasTenantCall: boolean
  hasTenantInWhere: boolean
  hasDirectAuthAccess: boolean
  isPublic: boolean
  hasDbWrite: boolean
  hasDbSelect: boolean
  notes: string[]
}

function listFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...listFiles(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

function isPublicPath(rel: string): boolean {
  return KNOWN_PUBLIC.some(pub => rel.startsWith(pub))
}

function isExcluded(rel: string): boolean {
  return EXCLUDED.some(ex => rel.includes(ex))
}

function audit(file: string): AuditResult {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/')
  const apiPath = relative(ROOT, file).replace(/\\/g, '/').replace(/\.ts$/, '')
  const content = readFileSync(file, 'utf-8')

  const result: AuditResult = {
    path: apiPath,
    hasTenantImport: /from ['"][~@]\/server\/utils\/tenant['"]/.test(content),
    hasTenantCall: /\bgetTenantIdFromEvent\s*\(/.test(content),
    hasTenantInWhere: /\beq\s*\(\s*[a-zA-Z_]+\.tenantId\s*,\s*tenantId\s*\)/.test(content)
      || /tenantId\s*:\s*tenantId/.test(content)
      || /eq\([^,)]+\.tenantId/.test(content)
      // Shorthand object property dans .values({ tenantId, ... }) — INSERT
      || /\.values\s*\(\s*\{[^}]*\btenantId(?:\s*[,}]|\s*:)/.test(content)
      // Shorthand dans flatMap/map → ({ tenantId: tenant.id, ... })
      || /\btenantId\s*:\s*[a-zA-Z_.]+\.id/.test(content),
    hasDirectAuthAccess: /event\.context\.auth\.tenantId/.test(content),
    isPublic: isPublicPath(apiPath),
    hasDbWrite: /\.(insert|update|delete)\s*\(/.test(content),
    hasDbSelect: /\.select\s*\(/.test(content),
    notes: [],
  }

  if (result.isPublic) result.notes.push('Endpoint public (pas de tenant requis)')
  if (result.hasDirectAuthAccess) result.notes.push('🔴 ANTI-PATTERN : lit event.context.auth.tenantId directement (CLAUDE.md interdit)')

  if (!result.isPublic) {
    if (!result.hasTenantCall) result.notes.push('🔴 N\'appelle PAS getTenantIdFromEvent')
    if ((result.hasDbSelect || result.hasDbWrite) && !result.hasTenantInWhere) {
      result.notes.push('🟠 Aucune WHERE eq(tenantId) détectée — vérifier manuellement')
    }
  }

  void rel // évite warning unused
  return result
}

function main() {
  const files = listFiles(ROOT).filter(f => !isExcluded(relative(REPO_ROOT, f)))
  const results = files.map(audit)

  const violations = results.filter(r =>
    !r.isPublic && (
      r.hasDirectAuthAccess
      || !r.hasTenantCall
      || ((r.hasDbSelect || r.hasDbWrite) && !r.hasTenantInWhere)
    ),
  )
  const publics = results.filter(r => r.isPublic)
  const conformes = results.filter(r => !r.isPublic && !r.hasDirectAuthAccess && r.hasTenantCall && (!r.hasDbSelect && !r.hasDbWrite || r.hasTenantInWhere))

  console.log(`\n📊 Audit isolation tenant — ${results.length} endpoints\n`)
  console.log(`✅ Conformes : ${conformes.length}`)
  console.log(`🔓 Publics  : ${publics.length}`)
  console.log(`⚠️  Suspects : ${violations.length}\n`)

  if (publics.length > 0) {
    console.log('🔓 Endpoints publics (intentionnel) :')
    for (const r of publics) console.log(`  - ${r.path}`)
    console.log('')
  }

  if (violations.length > 0) {
    console.log('⚠️  Endpoints suspects (à inspecter) :\n')
    for (const r of violations) {
      console.log(`  ${r.path}`)
      for (const note of r.notes) console.log(`    ${note}`)
    }
    console.log('')
  }

  // Exit 1 si violations critiques (anti-pattern auth ou pas de getTenantIdFromEvent)
  const critical = violations.filter(r =>
    r.hasDirectAuthAccess || (!r.hasTenantCall && !r.isPublic),
  )
  if (critical.length > 0) {
    console.log(`❌ ${critical.length} violation(s) critique(s) — fail.\n`)
    process.exit(1)
  }
  console.log('✅ Aucune violation critique.\n')
}

main()
