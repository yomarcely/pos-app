import { useAuthStore } from '@/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) return

  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    await auth.restoreSession()
  }

  const isLoginRoute = to.path.startsWith('/login')

  if (!auth.isAuthenticated && !isLoginRoute) {
    const redirect = encodeURIComponent(to.fullPath)
    return navigateTo(`/login?redirect=${redirect}`)
  }

  if (auth.isAuthenticated && isLoginRoute) {
    const fallback = typeof to.query.redirect === 'string' ? to.query.redirect : '/dashboard'
    return navigateTo(fallback)
  }
})
