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
const connectionString = getDatabaseUrl()

export const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
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
