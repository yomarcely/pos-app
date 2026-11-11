import * as Sentry from '@sentry/nuxt'
// Import relatif volontaire : ce fichier est chargé avant le serveur Nitro,
// hors des alias `~/` garantis au reste du code.
import { scrubSentryEvent } from './server/utils/sentryScrub'

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

    // RGPD : pas d'envoi PII par défaut. Ce réglage ne suffit pas : le SDK joint
    // quand même les en-têtes, cookies et corps de requête, et laisse passer les
    // en-têtes d'adresse IP.
    sendDefaultPii: false,

    // On retire donc ici le jeton de session, le CRON_SECRET, les cookies, l'IP
    // et le contenu des requêtes — sur les erreurs/messages ET sur les traces.
    // Détail de ce qui est couvert et de ce qui ne l'est pas (URL et query
    // string conservées) : server/utils/sentryScrub.ts.
    beforeSend: event => scrubSentryEvent(event),
    beforeSendTransaction: event => scrubSentryEvent(event),

    // Logs forwarder désactivé en prod (coûteux côté quota Sentry).
    enableLogs: !isProd,

    debug: false,
  })
}
