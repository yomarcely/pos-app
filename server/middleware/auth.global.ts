import { assertAuth, getAccessTokenFromEvent, getTenantFromUser, supabaseServerClient } from '~/server/utils/supabase'
import { resolveRole } from '~/server/utils/roles'
import { logger } from '~/server/utils/logger'
import { timingSafeEqual } from 'node:crypto'

const PUBLIC_ENDPOINTS = ['/api/login', '/api/auth']

/**
 * Endpoints internes déclenchés par un planificateur (Vercel Cron), A5.
 *
 * Liste VOLONTAIREMENT distincte de PUBLIC_ENDPOINTS (règle absolue n°8) : ces
 * routes ne sont pas publiques, elles sont authentifiées AUTREMENT — par un
 * secret partagé hors bande (`CRON_SECRET`), pas par une session utilisateur.
 * Les confondre reviendrait à faire passer un audit de PUBLIC_ENDPOINTS pour
 * une revue d'exposition complète, alors que la surface est différente :
 * pas de tenant dans le contexte, pas de rôle, un appelant machine.
 *
 * Conséquence côté handler : `event.context.auth` n'est JAMAIS posé ici, donc
 * `getTenantIdFromEvent` lèverait 401. Un endpoint interne détermine lui-même
 * les tenants sur lesquels il travaille.
 */
const CRON_ENDPOINTS = ['/api/internal/']

/**
 * `true` si le chemin relève d'un préfixe interne : le dossier lui-même
 * (`/api/internal`, là où serait servie une route `index`) ou tout ce qui est
 * dessous (`/api/internal/…`). La query string est écartée avant comparaison.
 *
 * Sans le cas « chemin exact », une route index sous `server/api/internal/`
 * échapperait à la garde CRON_SECRET et tomberait dans `assertAuth` : un handler
 * écrit pour un appelant machine deviendrait accessible à tout utilisateur
 * connecté (relecture A5, 2026-11-11).
 */
function isCronPath(path: string): boolean {
  const pathname = path.split('?')[0] ?? ''
  return CRON_ENDPOINTS.some((prefix) => {
    const base = prefix.replace(/\/$/, '')
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

/** Comparaison à temps constant, tolérante aux longueurs différentes. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Extrait le secret présenté : `Authorization: Bearer <secret>` (ce que Vercel
 * Cron envoie automatiquement quand CRON_SECRET est défini) ou `x-cron-secret`
 * (appel manuel / curl de vérification depuis un runbook).
 */
function getPresentedCronSecret(event: Parameters<typeof getHeader>[0]): string | null {
  const auth = getHeader(event, 'authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length)
  return getHeader(event, 'x-cron-secret') || null
}

// Fail-closed au boot : refuse de démarrer si ALLOW_AUTH_BYPASS=true hors dev.
// Évite qu'une variable oubliée dans un .env staging/prod désactive l'auth silencieusement.
if (process.env.ALLOW_AUTH_BYPASS === 'true') {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      '[auth.global] Configuration invalide : ALLOW_AUTH_BYPASS=true est interdit hors NODE_ENV=development.'
    )
  }
  logger.warn('[auth.global] ALLOW_AUTH_BYPASS=true détecté (dev uniquement) — auth désactivable par requête')
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api')) return
  if (event.method === 'OPTIONS') return

  const isPublic = PUBLIC_ENDPOINTS.some(publicPath => path.startsWith(publicPath))
  if (isPublic) return

  // Endpoints internes : le secret est vérifié AVANT tout autre traitement
  // (pas de lecture de body, pas d'appel Supabase, pas de requête DB). Secret
  // non configuré, absent ou faux → 401 immédiat et fail-closed : sans
  // CRON_SECRET en environnement, la route est inaccessible, jamais ouverte.
  if (isCronPath(path)) {
    const expected = process.env.CRON_SECRET?.trim()
    const presented = getPresentedCronSecret(event)

    if (!expected || !presented || !secretsMatch(presented, expected)) {
      logger.warn({ path, hasSecret: Boolean(presented), configured: Boolean(expected) }, '[auth.global] Accès refusé à un endpoint interne (CRON_SECRET)')
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    // Authentifié comme appelant machine : on ne pose PAS event.context.auth.
    return
  }

  // Auth bypass explicite (uniquement si ALLOW_AUTH_BYPASS=true est défini)
  // ATTENTION: Ne JAMAIS activer en production !
  const allowAuthBypass = process.env.ALLOW_AUTH_BYPASS === 'true'
  const config = useRuntimeConfig()

  if (allowAuthBypass && config.public.nodeEnv === 'development') {
    logger.warn({ path }, '⚠️  [DEV MODE - AUTH BYPASS] Auth middleware bypassed')

    // Essayer de récupérer le token et l'utilisateur
    const token = getAccessTokenFromEvent(event)

    if (token && supabaseServerClient) {
      const { data, error: getUserError } = await supabaseServerClient.auth.getUser(token)
      if (getUserError) {
        logger.warn({ path, err: getUserError }, '[DEV MODE] getUser error — aucun contexte auth défini')
      } else if (data.user) {
        const tenantId = getTenantFromUser(data.user, event)
        if (tenantId) {
          event.context.auth = {
            user: data.user,
            accessToken: token,
            tenantId,
            role: resolveRole(data.user),
          }
        }
        logger.debug({ tenantId, userId: data.user.id }, '✅ [DEV MODE] Auth context set')
      }
    }

    return
  }

  // En production ou si ALLOW_AUTH_BYPASS n'est pas activé, l'auth est obligatoire
  await assertAuth(event)
})
