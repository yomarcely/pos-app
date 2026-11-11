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

// Endpoints internes déclenchés par un planificateur (Vercel Cron), A5.
// Catégorie SÉPARÉE des publics à dessein : ils ne sont pas publics — ils sont
// authentifiés par CRON_SECRET dans server/middleware/auth.global.ts
// (CRON_ENDPOINTS), pas par une session. Ils n'ont donc pas de tenant dans le
// contexte et déterminent eux-mêmes leur périmètre : `getTenantIdFromEvent` y
// est inapplicable, mais chaque requête reste scopée par un tenantId explicite.
//
// Liste de FICHIERS EXACTS (chemin sous server/api, sans `.ts`), pas un préfixe.
// Un nouvel endpoint sous server/api/internal/ n'est donc PAS exempté d'office :
// il retombe dans le contrôle normal et fait échouer l'audit tant qu'il n'a pas
// été relu puis ajouté ici (invariant 9 de CLAUDE.md : même audit que la règle
// absolue n°8). Exempter tout le dossier laisserait passer au vert un endpoint
// interne qui lit sans filtre tenant (relecture A5, 2026-11-11).
// Doit rester identique à `knownInternalCron` dans tests/unit/tenantIsolation.test.ts.
const KNOWN_INTERNAL_CRON = [
  'internal/verify-chains.get',
]

/** Dossier des endpoints internes — sert uniquement à rédiger un message d'erreur utile. */
const INTERNAL_DIR = 'internal/'

// Fichiers exclus de l'audit (exemples tiers, code de wizard, etc.)
const EXCLUDED: string[] = []

interface AuditResult {
  path: string
  hasTenantImport: boolean
  hasTenantCall: boolean
  hasTenantInWhere: boolean
  hasDirectAuthAccess: boolean
  isPublic: boolean
  isInternalCron: boolean
  /** Sous server/api/internal/ mais absent de KNOWN_INTERNAL_CRON : jamais relu. */
  isUnreviewedInternal: boolean
  /** Sous server/api/internal/ sans suffixe de méthode (`x.ts` au lieu de `x.get.ts`). */
  isInternalWithoutMethod: boolean
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

function isInternalCronPath(rel: string): boolean {
  return KNOWN_INTERNAL_CRON.includes(rel)
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
    isInternalCron: isInternalCronPath(apiPath),
    isUnreviewedInternal: apiPath.startsWith(INTERNAL_DIR) && !isInternalCronPath(apiPath),
    isInternalWithoutMethod: apiPath.startsWith(INTERNAL_DIR) && !/\.(get|post|put|patch|delete)$/.test(apiPath),
    hasDbWrite: /\.(insert|update|delete)\s*\(/.test(content),
    hasDbSelect: /\.select\s*\(/.test(content),
    notes: [],
  }

  if (result.isPublic) result.notes.push('Endpoint public (pas de tenant requis)')
  if (result.isInternalCron) result.notes.push('Endpoint interne cron (auth par CRON_SECRET, tenants déterminés par le handler)')
  if (result.hasDirectAuthAccess) result.notes.push('🔴 ANTI-PATTERN : lit event.context.auth.tenantId directement (CLAUDE.md interdit)')

  // Violations propres aux endpoints internes — critiques EN SOI, quel que soit
  // le contenu du fichier. Ne pas les faire dépendre de l'absence du texte
  // `getTenantIdFromEvent(` : un simple commentaire qui le cite suffirait à
  // faire passer un endpoint non relu (relecture du 2026-11-11).
  if (result.isUnreviewedInternal) {
    result.notes.push('🔴 Endpoint interne NON RELU : absent de KNOWN_INTERNAL_CRON. Audit sécurité requis (CLAUDE.md, invariant 9) avant de l\'y ajouter.')
  }
  // Le middleware d'auth laisse passer toute requête OPTIONS avant la garde
  // CRON_SECRET. Un handler sans suffixe de méthode répond à OPTIONS : il
  // s'exécuterait donc sans secret. Avec un suffixe, Nitro répond 405.
  if (result.isInternalWithoutMethod) {
    result.notes.push('🔴 Endpoint interne SANS SUFFIXE DE MÉTHODE : il répondrait à OPTIONS, que le middleware laisse passer sans CRON_SECRET. Le nommer `.get.ts`, `.post.ts`…')
  }

  if (!result.isPublic && !result.isInternalCron && !result.isUnreviewedInternal) {
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

  // L'anti-pattern `event.context.auth.tenantId` reste une violation PARTOUT,
  // y compris sur un endpoint interne (il n'y a pas de contexte auth à y lire).
  const violations = results.filter(r =>
    r.hasDirectAuthAccess
    || r.isUnreviewedInternal
    || r.isInternalWithoutMethod
    || (!r.isPublic && !r.isInternalCron && (
      !r.hasTenantCall
      || ((r.hasDbSelect || r.hasDbWrite) && !r.hasTenantInWhere)
    )),
  )
  const publics = results.filter(r => r.isPublic)
  const internalCrons = results.filter(r => r.isInternalCron)
  const conformes = results.filter(r => !r.isPublic && !r.isInternalCron && !r.isUnreviewedInternal && !r.hasDirectAuthAccess && r.hasTenantCall && (!r.hasDbSelect && !r.hasDbWrite || r.hasTenantInWhere))

  console.log(`\n📊 Audit isolation tenant — ${results.length} endpoints\n`)
  console.log(`✅ Conformes : ${conformes.length}`)
  console.log(`🔓 Publics  : ${publics.length}`)
  console.log(`🔐 Internes cron : ${internalCrons.length}`)
  console.log(`⚠️  Suspects : ${violations.length}\n`)

  if (publics.length > 0) {
    console.log('🔓 Endpoints publics (intentionnel) :')
    for (const r of publics) console.log(`  - ${r.path}`)
    console.log('')
  }

  if (internalCrons.length > 0) {
    console.log('🔐 Endpoints internes cron (auth CRON_SECRET, hors session utilisateur) :')
    for (const r of internalCrons) console.log(`  - ${r.path}`)
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

  // Exit 1 si violations critiques (anti-pattern auth, pas de getTenantIdFromEvent,
  // endpoint interne non relu ou sans suffixe de méthode)
  const critical = violations.filter(r =>
    r.hasDirectAuthAccess
    || r.isUnreviewedInternal
    || r.isInternalWithoutMethod
    || (!r.hasTenantCall && !r.isPublic && !r.isInternalCron),
  )
  if (critical.length > 0) {
    console.log(`❌ ${critical.length} violation(s) critique(s) — fail.\n`)
    process.exit(1)
  }
  console.log('✅ Aucune violation critique.\n')
}

main()
