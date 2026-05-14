import * as Sentry from '@sentry/nuxt'

const config = useRuntimeConfig()
const dsn = config.public.sentry?.dsn || ''
const env = config.public.sentry?.environment || 'development'
const isProd = env === 'production'

// Skip init si pas de DSN configuré (dev local sans Sentry)
if (dsn) {
  Sentry.init({
    dsn,
    environment: env,

    // 100% en dev/staging pour tout voir, 10% en prod pour limiter les coûts
    tracesSampleRate: isProd ? 0.1 : 1.0,

    // Session Replay : 0 en dev (pas utile), 5% en prod, 100% sur erreur
    replaysSessionSampleRate: isProd ? 0.05 : 0,
    replaysOnErrorSampleRate: 1.0,

    integrations: [Sentry.replayIntegration({
      maskAllText: true, // RGPD : masque le texte par défaut
      blockAllMedia: true,
    })],

    // RGPD : pas d'envoi PII par défaut (email, IP). Activer explicitement si besoin.
    sendDefaultPii: false,

    // Logs forwarder désactivé en prod (coûteux). Activer ponctuellement pour debug.
    enableLogs: !isProd,

    debug: false,
  })
}
