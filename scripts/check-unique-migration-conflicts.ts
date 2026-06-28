import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db, closeConnection } from '../server/database/connection'

/**
 * Vérification pré-migration : détecte les doublons qui violeraient les
 * nouvelles contraintes uniques composites (migration "hygiène schema") :
 *   - sales (tenant_id, ticket_number)
 *   - closures (tenant_id, closure_hash)
 *   - sellers (tenant_id, code)
 *
 * À exécuter sur staging/prod AVANT pnpm db:migrate.
 * Exit code 1 si des doublons existent.
 */

const checks = [
  {
    label: 'sales (tenant_id, ticket_number)',
    query: `
      SELECT tenant_id, ticket_number, COUNT(*) AS n
      FROM sales
      GROUP BY tenant_id, ticket_number
      HAVING COUNT(*) > 1
      ORDER BY n DESC
      LIMIT 50
    `,
  },
  {
    label: 'closures (tenant_id, closure_hash)',
    query: `
      SELECT tenant_id, closure_hash, COUNT(*) AS n
      FROM closures
      GROUP BY tenant_id, closure_hash
      HAVING COUNT(*) > 1
      ORDER BY n DESC
      LIMIT 50
    `,
  },
  {
    label: 'sellers (tenant_id, code)',
    query: `
      SELECT tenant_id, code, COUNT(*) AS n
      FROM sellers
      WHERE code IS NOT NULL
      GROUP BY tenant_id, code
      HAVING COUNT(*) > 1
      ORDER BY n DESC
      LIMIT 50
    `,
  },
]

async function checkUniqueConflicts() {
  let hasConflicts = false

  try {
    for (const { label, query } of checks) {
      const result = await db.execute(sql.raw(query))
      const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []

      if (rows.length === 0) {
        console.log(`✅ ${label} : aucun doublon`)
      } else {
        hasConflicts = true
        console.error(`❌ ${label} : ${rows.length} doublon(s) détecté(s)`)
        console.table(rows)
      }
    }

    if (hasConflicts) {
      console.error('\n❌ Doublons présents — corriger les données avant d\'appliquer la migration.')
      process.exitCode = 1
    } else {
      console.log('\n✅ Aucun conflit — la migration peut être appliquée.')
    }
  } finally {
    await closeConnection()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkUniqueConflicts()
}

export { checkUniqueConflicts }
