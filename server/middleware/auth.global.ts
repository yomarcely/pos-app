import { assertAuth, getAccessTokenFromEvent, getTenantFromUser, supabaseServerClient } from '~/server/utils/supabase'

const PUBLIC_ENDPOINTS = ['/api/login', '/api/auth', '/api/database/seed']

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api')) return
  if (event.method === 'OPTIONS') return

  const isPublic = PUBLIC_ENDPOINTS.some(publicPath => path.startsWith(publicPath))
  if (isPublic) return

  // En mode développement, on inject quand même le tenantId mais sans bloquer
  const config = useRuntimeConfig()
  if (config.public.nodeEnv === 'development') {
    console.log(`⚠️  [DEV MODE] Auth middleware for: ${path}`)

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
        console.log(`✅ [DEV MODE] TenantId set to: ${tenantId}`)
      }
    }

    return
  }

  await assertAuth(event)
})
