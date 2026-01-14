import { assertAuth, getAccessTokenFromEvent, getTenantFromUser, supabaseServerClient } from '~/server/utils/supabase'
import { logger } from '~/server/utils/logger'

const PUBLIC_ENDPOINTS = ['/api/login', '/api/auth', '/api/database/seed']

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api')) return
  if (event.method === 'OPTIONS') return

  const isPublic = PUBLIC_ENDPOINTS.some(publicPath => path.startsWith(publicPath))
  if (isPublic) return

  // Auth bypass explicite (uniquement si ALLOW_AUTH_BYPASS=true est défini)
  // ATTENTION: Ne JAMAIS activer en production !
  const allowAuthBypass = process.env.ALLOW_AUTH_BYPASS === 'true'
  const config = useRuntimeConfig()

  if (allowAuthBypass && config.public.nodeEnv === 'development') {
    logger.warn({ path }, '⚠️  [DEV MODE - AUTH BYPASS] Auth middleware bypassed')

    // Essayer de récupérer le token et l'utilisateur
    const token = getAccessTokenFromEvent(event)

    if (token && supabaseServerClient) {
      const { data } = await supabaseServerClient.auth.getUser(token)
      if (data.user) {
        const tenantId = getTenantFromUser(data.user, event)
        event.context.auth = {
          user: data.user,
          accessToken: token,
          tenantId,
        }
        logger.debug({ tenantId, userId: data.user.id }, '✅ [DEV MODE] Auth context set')
      }
    }

    return
  }

  // En production ou si ALLOW_AUTH_BYPASS n'est pas activé, l'auth est obligatoire
  await assertAuth(event)
})
