import { useAuthStore } from '@/stores/auth'
import { createAuthRetryFetch } from '@/utils/authRetryFetch'

export default defineNuxtPlugin(() => {
  const auth = useAuthStore()

  const rawFetch = $fetch.create({
    // Pas de retry implicite ofetch : le seul retry applicatif est celui de
    // validerVente (useCheckout), idempotent via clientSaleId.
    retry: false,
    onRequest({ options }) {
      options.headers = {
        ...(options.headers || {}),
        ...auth.getAuthHeaders(),
      }
    },
  })

  // Sur 401 : tente UN refresh puis rejoue la requête ; sinon signOut + /login.
  const apiFetch = createAuthRetryFetch(rawFetch, {
    refresh: () => auth.refreshSession(),
    onSessionExpired: async () => {
      // Session expirée et non rattrapable : on conserve le panier (P2.1).
      await auth.signOut({ sessionExpired: true })
      await navigateTo('/login')
    },
  })

  const nuxtApp = useNuxtApp()
  nuxtApp.$apiFetch = apiFetch
  ;(globalThis as { $fetch?: typeof apiFetch }).$fetch = apiFetch

  return {
    provide: {
      apiFetch,
    },
  }
})
