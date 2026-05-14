import * as Sentry from '@sentry/nuxt'

// Côté serveur : on ne peut pas utiliser useRuntimeConfig() ici (pas dans une nitro request).
// On lit directement les env vars. Le DSN public peut être identique au client.
const dsn = process.env.SENTRY_DSN || process.env.NUXT_PUBLIC_SENTRY_DSN || ''
const env = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
const isProd = env === 'production'

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,

    // 100% en dev/staging, 10% en prod
    tracesSampleRate: isProd ? 0.1 : 1.0,

    // RGPD : pas d'envoi PII par défaut (IP, headers). À activer ponctuellement si besoin.
    sendDefaultPii: false,

    // Logs forwarder désactivé en prod (coûteux côté quota Sentry).
    enableLogs: !isProd,

    debug: false,
  })
}
