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

// Ajouter les options PostgreSQL pour augmenter les timeouts
if (isSupabasePooler) {
  const separator = connectionString.includes('?') ? '&' : '?'
  connectionString += `${separator}options=-c%20statement_timeout%3D60000`
}

// Détecter le mode du pooler (Session = 5432, Transaction = 6543)
const isSessionMode = connectionString.includes(':5432')
const isTransactionMode = connectionString.includes(':6543')

export const client = postgres(connectionString, {
  // Session mode: peut utiliser plusieurs connexions
  // Transaction mode: max 1 connexion car pooler gère le pooling
  max: isTransactionMode ? 1 : (isSupabasePooler ? 3 : 10),

  // Timeouts adaptés selon le mode
  idle_timeout: isSupabasePooler ? 0 : 20, // 0 = pas de timeout idle pour Supabase
  connect_timeout: isSupabasePooler ? 30 : 10,

  // SSL requis pour Supabase
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,

  // Transaction mode ne supporte pas les prepared statements
  ...(isTransactionMode && {
    prepare: false,
  }),
})

export const db = drizzle(client, { schema })

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
