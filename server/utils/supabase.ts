import { createClient, type User } from '@supabase/supabase-js'
import { resolveRole } from '~/server/utils/roles'

// `getHeader`, `parseCookies`, `createError` sont auto-importés par Nuxt côté server/.
// L'import explicite depuis 'h3' échoue en CI Linux car h3 est une dep transitive
// non hoistée par pnpm. Pour le type H3Event on utilise un type inline (érasé par TS).
type H3Event = import('h3').H3Event

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseServerClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

export const getAccessTokenFromEvent = (event: H3Event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.split(' ')[1]
  }

  const cookies = parseCookies(event)
  return cookies['sb-access-token'] || cookies['supabase-auth-token'] || null
}

export const getTenantFromUser = (user: User | null, event: H3Event) => {
  const meta = (user?.app_metadata || user?.user_metadata || {}) as Record<string, unknown>

  // Liste des tenants auxquels l'utilisateur a réellement droit, dérivée
  // EXCLUSIVEMENT de ses métadonnées de confiance (posées côté serveur Supabase).
  // Sert à valider un éventuel header `x-tenant-id` : sans ce contrôle, un
  // utilisateur authentifié pourrait forger le header et accéder aux données
  // d'un autre tenant (broken access control / défaut d'isolation multi-tenant).
  const allowedTenants = new Set<string>()

  const explicitTenant = meta.tenant_id || meta.tenantId
  if (explicitTenant) allowedTenants.add(String(explicitTenant))

  if (Array.isArray(meta.tenants)) {
    for (const t of meta.tenants) {
      const id = t?.id || t?.tenant_id || t?.slug
      if (id) allowedTenants.add(String(id))
    }
  }

  // Convention 1 user = 1 tenant : l'utilisateur a toujours droit à son propre id.
  if (user?.id) allowedTenants.add(String(user.id))

  // Priorité 1: Header explicite x-tenant-id — accepté UNIQUEMENT s'il figure
  // dans la liste autorisée. Sinon on retourne null (assertAuth lèvera 400) sans
  // 403 détaillé qui confirmerait l'existence du tenant ciblé.
  const headerTenant = getHeader(event, 'x-tenant-id')
  if (headerTenant) {
    return allowedTenants.has(String(headerTenant)) ? String(headerTenant) : null
  }

  // Sans header : comportement historique inchangé.
  // Priorité 2: Métadonnées utilisateur (tenant_id ou tenantId)
  if (explicitTenant) return String(explicitTenant)

  // Priorité 3: Premier tenant dans la liste des tenants
  if (Array.isArray(meta.tenants) && meta.tenants.length > 0) {
    return String(meta.tenants[0].id || meta.tenants[0].tenant_id || meta.tenants[0].slug)
  }

  // Priorité 4: Fallback 1 user = 1 tenant (convention pour utilisateurs sans organisation)
  if (user?.id) {
    return String(user.id)
  }

  // Aucun tenant trouvé - retourner null pour que assertAuth lève une erreur
  return null
}

export const assertAuth = async (event: H3Event) => {
  if (!supabaseServerClient) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase non configuré côté serveur',
    })
  }

  const token = getAccessTokenFromEvent(event)

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Token d\'authentification manquant',
    })
  }

  const { data, error } = await supabaseServerClient.auth.getUser(token)

  if (error || !data.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Session invalide',
    })
  }

  const tenantId = getTenantFromUser(data.user, event)

  if (!tenantId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Aucun tenant sélectionné',
    })
  }

  event.context.auth = {
    user: data.user,
    accessToken: token,
    tenantId,
    role: resolveRole(data.user),
  }

  return event.context.auth
}
