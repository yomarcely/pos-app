/**
 * ==========================================
 * Nettoyage des événements Sentry avant envoi
 * ==========================================
 *
 * Le SDK Sentry joint par défaut à chaque événement serveur (erreur, message,
 * trace) les données de la requête HTTP en cours : en-têtes, cookies et corps.
 * Vérifié dans @sentry/core 10.50 (`integrations/requestdata.js`, `headers: true`,
 * `cookies: true`, `data: true`) et @sentry/node-core (`maxRequestBodySize:
 * 'medium'`). `sendDefaultPii: false` n'y change presque rien (voir IP ci-dessous).
 *
 * Conséquence sans ce filtre : partent chez un tiers
 * - `Authorization: Bearer <jeton de session>` de l'utilisateur, à chaque erreur ;
 * - `Authorization: Bearer <CRON_SECRET>` (ou `x-cron-secret`) à chaque alerte
 *   émise par le cron — un secret statique et durable ;
 * - le corps des requêtes : contenu d'une vente, fiche client (nom, téléphone) ;
 * - l'adresse IP du client, par les en-têtes de proxy et par les traces.
 *
 * Deux endroits sont nettoyés :
 * 1. `event.request` — en-têtes, cookies, corps ;
 * 2. les attributs de traces (`contexts.trace.data`, `spans[].data`), où le SDK
 *    recopie les en-têtes (`http.request.header.*`) et l'IP (`http.client_ip`).
 *    Le SDK y masque déjà lui-même `authorization` et les noms évocateurs ; on
 *    retire en plus l'IP et TOUS les cookies, quel que soit leur nom.
 *
 * NON couvert, à connaître : l'URL et sa query string sont conservées (un terme
 * de recherche client y figure), et le filtre des en-têtes est une liste de noms
 * à retirer, pas une liste de noms autorisés.
 *
 * Ce module est volontairement SANS DÉPENDANCE (ni logger, ni Sentry) : il est
 * importé par `sentry.server.config.ts`, chargé avant tout le reste du serveur.
 *
 * ⚠️ Il ne doit JAMAIS lever : si `beforeSend` lève, le SDK émet un événement
 * d'erreur interne qui ne repasse pas par `beforeSend` et porte les en-têtes.
 *
 * Constats d'origine : relectures d'A5 des 2026-11-10 et 2026-11-11.
 */

/** En-têtes retirés quel que soit leur contenu (comparaison insensible à la casse). */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-cron-secret',
])

/**
 * En-têtes porteurs de l'adresse IP du client. Le SDK est censé les retirer quand
 * `sendDefaultPii` est faux, mais il compare des noms en casse titre
 * (`X-Forwarded-For`) à des clés en minuscules : il ne retire rien (vérifié,
 * @sentry/core 10.50.0, `vendor/getIpAddress.js`). Même liste, en minuscules.
 */
const IP_HEADERS = new Set([
  'x-client-ip',
  'x-forwarded-for',
  'fly-client-ip',
  'cf-connecting-ip',
  'fastly-client-ip',
  'true-client-ip',
  'x-real-ip',
  'x-cluster-client-ip',
  'x-forwarded',
  'forwarded-for',
  'forwarded',
  'x-vercel-forwarded-for',
])

/** Filet pour un en-tête sensible ajouté plus tard et oublié dans les listes ci-dessus. */
const SENSITIVE_HEADER_PATTERN = /secret|token|api-?key|password/i

function isSensitiveHeader(name: string): boolean {
  const lower = name.toLowerCase()
  return SENSITIVE_HEADERS.has(lower) || IP_HEADERS.has(lower) || SENSITIVE_HEADER_PATTERN.test(lower)
}

/** Attributs de trace retirés tels quels (adresse IP du client). */
const SENSITIVE_ATTRIBUTES = new Set(['http.client_ip', 'client.address'])

/** Préfixes sous lesquels le SDK recopie les en-têtes : `http.request.header.<nom_avec_underscores>[.<cookie>]`. */
const HEADER_ATTRIBUTE_PREFIXES = ['http.request.header.', 'http.response.header.']

function isSensitiveAttribute(key: string): boolean {
  if (SENSITIVE_ATTRIBUTES.has(key)) return true

  const prefix = HEADER_ATTRIBUTE_PREFIXES.find(p => key.startsWith(p))
  if (!prefix) return false

  // `x_real_ip` → `x-real-ip` ; `cookie.sb_access_token` → en-tête `cookie`.
  const headerName = (key.slice(prefix.length).split('.')[0] ?? '').replace(/_/g, '-')
  return isSensitiveHeader(headerName)
}

function scrubAttributes(data: unknown): void {
  if (!data || typeof data !== 'object') return
  const attributes = data as Record<string, unknown>
  for (const key of Object.keys(attributes)) {
    if (isSensitiveAttribute(key)) {
      delete attributes[key]
    }
  }
}

/** Forme minimale d'un événement Sentry — seules ces parties nous intéressent. */
interface ScrubbableEvent {
  request?: {
    headers?: Record<string, unknown>
    cookies?: unknown
    data?: unknown
  }
  contexts?: {
    trace?: { data?: unknown }
  }
  spans?: Array<{ data?: unknown }>
}

/**
 * Retire d'un événement Sentry les secrets, l'IP et le contenu de la requête.
 * Modifie l'événement en place et le renvoie (contrat de `beforeSend`).
 *
 * Ne lève jamais : en cas d'imprévu, la partie concernée est supprimée en bloc —
 * mieux vaut un événement sans contexte HTTP qu'un secret envoyé.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  try {
    const request = event.request
    if (request) {
      if (request.headers && typeof request.headers === 'object') {
        for (const name of Object.keys(request.headers)) {
          if (isSensitiveHeader(name)) {
            delete request.headers[name]
          }
        }
      }
      delete request.cookies
      delete request.data
    }
  } catch {
    delete event.request
  }

  try {
    scrubAttributes(event.contexts?.trace?.data)
    if (Array.isArray(event.spans)) {
      for (const span of event.spans) scrubAttributes(span?.data)
    }
  } catch {
    try {
      delete event.spans
      if (event.contexts?.trace) delete event.contexts.trace.data
    } catch {
      // Rien de plus à tenter sans lever.
    }
  }

  return event
}
