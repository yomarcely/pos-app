import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Configuration de la connexion PostgreSQL
 *
 * Support mode hybride :
 * - Local : PostgreSQL sur localhost (mode offline)
 * - Cloud : PostgreSQL distant (mode online avec sync)
 */

const getDatabaseUrl = () => {
  // En production cloud
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // En local
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || '5432'
  const user = process.env.DB_USER || 'postgres'
  const password = process.env.DB_PASSWORD || 'postgres'
  const database = process.env.DB_NAME || 'pos_app'

  return `postgres://${user}:${password}@${host}:${port}/${database}`
}

// Connexion PostgreSQL
let connectionString = getDatabaseUrl()
const useSSL = process.env.DB_SSL === 'true' || connectionString.includes('supabase.co')

// Détecter si on utilise le pooler Supabase (Transaction mode)
const isSupabasePooler = connectionString.includes('pooler.supabase.com')

// Options PostgreSQL par session :
// - statement_timeout : borne toute requête à 60s
// - idle_in_transaction_session_timeout : si le runtime est tué en pleine transaction
//   (serverless), PostgreSQL rollback et libère les verrous après 30s au lieu de
//   bloquer indéfiniment la caisse (zombie constaté sur staging le 2026-07-03).
//   Également posé au niveau base via ALTER DATABASE (cf. runbook staging).
if (isSupabasePooler) {
  const separator = connectionString.includes('?') ? '&' : '?'
  connectionString += `${separator}options=-c%20statement_timeout%3D60000%20-c%20idle_in_transaction_session_timeout%3D30000`
}

// Détecter le mode du pooler (Session = 5432, Transaction = 6543)
const isSessionMode = connectionString.includes(':5432')
const isTransactionMode = connectionString.includes(':6543')

export const client = postgres(connectionString, {
  // Session mode: peut utiliser plusieurs connexions
  // Transaction mode: max 1 connexion car pooler gère le pooling
  max: isTransactionMode ? 1 : (isSupabasePooler ? 3 : 10),

  // Serverless (Vercel) : l'instance est gelée entre deux requêtes — une connexion
  // gardée ouverte indéfiniment (idle_timeout 0) devient un socket mort au réveil
  // et chaque requête attendait connect_timeout avant de se reconnecter (blocages
  // de ~30s constatés sur staging le 2026-07-03). Config recommandée par postgres.js
  // pour le serverless : fermer les connexions inactives et les recycler.
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  // Échouer vite et laisser postgres.js rouvrir une connexion fraîche.
  connect_timeout: 10,

  // SSL requis pour Supabase
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,

  // Transaction mode ne supporte pas les prepared statements
  ...(isTransactionMode && {
    prepare: false,
  }),
})

export const db = drizzle(client, { schema })

/**
 * Exécuteur DB : la connexion globale, ou la transaction appelante.
 *
 * ⚠️ Tout helper qui écrit en base et peut être appelé DEPUIS une transaction
 * doit accepter ce paramètre et l'utiliser : en mode pooler (Vercel/staging/prod,
 * max 1 connexion), un accès via `db` pendant qu'une transaction est ouverte
 * attend la connexion que la transaction occupe → auto-deadlock (ventes et
 * mouvements figés 30s puis CONNECTION_CLOSED — constaté sur staging 2026-07-03).
 */
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Fonction utilitaire pour tester la connexion
 */
export async function testConnection() {
  try {
    await client`SELECT 1`
    console.log('✅ Connexion PostgreSQL réussie')
    return true
  } catch (error) {
    console.error('❌ Erreur de connexion PostgreSQL:', error)
    return false
  }
}

/**
 * Fermer la connexion proprement
 */
export async function closeConnection() {
  await client.end()
}
