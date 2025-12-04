import { useAuthStore } from '@/stores/auth'

export default defineNuxtPlugin(() => {
  const auth = useAuthStore()

  const apiFetch = $fetch.create({
    onRequest({ options }) {
      options.headers = {
        ...(options.headers || {}),
        ...auth.getAuthHeaders(),
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        auth.signOut().finally(() => navigateTo('/login'))
      }
    },
  })

  const nuxtApp = useNuxtApp()
  nuxtApp.$apiFetch = apiFetch
  ;(globalThis as any).$fetch = apiFetch

  return {
    provide: {
      apiFetch,
    },
  }
})
