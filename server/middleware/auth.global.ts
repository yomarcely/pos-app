import { assertAuth } from '~/server/utils/supabase'

const PUBLIC_ENDPOINTS = ['/api/login', '/api/auth', '/api/database/seed']

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api')) return
  if (event.method === 'OPTIONS') return

  const isPublic = PUBLIC_ENDPOINTS.some(publicPath => path.startsWith(publicPath))
  if (isPublic) return

  // En mode développement, désactiver l'auth temporairement
  const config = useRuntimeConfig()
  if (config.public.nodeEnv === 'development') {
    console.log(`⚠️  [DEV MODE] Auth middleware bypassed for: ${path}`)
    return
  }

  await assertAuth(event)
})
