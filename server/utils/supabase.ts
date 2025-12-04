import { createClient, type User } from '@supabase/supabase-js'
import { getHeader, parseCookies, createError, H3Event } from 'h3'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const defaultTenantId = process.env.DEFAULT_TENANT_ID

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
  const headerTenant = getHeader(event, 'x-tenant-id')
  if (headerTenant) return String(headerTenant)

  const meta = (user?.app_metadata || user?.user_metadata || {}) as Record<string, any>
  const tenant = meta.tenant_id || meta.tenantId
  if (tenant) return String(tenant)

  if (Array.isArray(meta.tenants) && meta.tenants.length > 0) {
    return String(meta.tenants[0].id || meta.tenants[0].tenant_id || meta.tenants[0].slug)
  }

  // Fallback 1 user = 1 tenant
  if (user?.id) {
    return String(user.id)
  }

  return defaultTenantId || null
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
  }

  return event.context.auth
}
