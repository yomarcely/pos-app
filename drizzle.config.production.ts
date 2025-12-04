import 'dotenv/config'
import type { Config } from 'drizzle-kit'

// Configuration Drizzle pour l'environnement PRODUCTION
// Charge les variables depuis .env.production

const rawUrl = (process.env.DATABASE_URL || '').trim()
const connectionString = rawUrl
  ? rawUrl.includes('sslmode=')
    ? rawUrl
    : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}sslmode=require`
  : undefined

if (!connectionString) {
  throw new Error('DATABASE_URL is required for production environment')
}

export default {
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
} satisfies Config
