import 'dotenv/config'
import type { Config } from 'drizzle-kit'

// Configuration Drizzle pour l'environnement DEVELOPMENT
// Charge les variables depuis .env.development

const rawUrl = (process.env.DATABASE_URL || '').trim()
const connectionString = rawUrl
  ? rawUrl.includes('sslmode=')
    ? rawUrl
    : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}sslmode=require`
  : undefined

export default {
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'postgresql',
  dbCredentials: connectionString
    ? {
        url: connectionString,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'pos_app_dev',
        ssl: process.env.DB_SSL === 'true',
      },
} satisfies Config
