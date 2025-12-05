import { useAuthStore } from '@/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) return

  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    await auth.restoreSession()
  }

  // Routes publiques (accessibles sans authentification)
  const publicRoutes = ['/login', '/signup']
  const isPublicRoute = publicRoutes.some(route => to.path.startsWith(route))

  // Si non authentifié et route non publique, rediriger vers login
  if (!auth.isAuthenticated && !isPublicRoute) {
    const redirect = encodeURIComponent(to.fullPath)
    return navigateTo(`/login?redirect=${redirect}`)
  }

  // Si authentifié et sur une route publique, rediriger vers dashboard
  if (auth.isAuthenticated && isPublicRoute) {
    const fallback = typeof to.query.redirect === 'string' ? to.query.redirect : '/dashboard'
    return navigateTo(fallback)
  }
})
