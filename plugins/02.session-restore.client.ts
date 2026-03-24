import { useAuthStore } from '@/stores/auth'

/**
 * Restaure la session Supabase côté client avant le premier rendu.
 * Cela garantit que sessionRestored = true avant que les layouts et
 * composants montent, évitant tout flash de contenu non authentifié.
 *
 * getSession() lit depuis le storage local — pas de requête réseau.
 */
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  if (!auth.sessionRestored) {
    try {
      await auth.restoreSession()
    } catch {
      // Session absente ou Supabase non configuré — sessionRestored = true
      // est garanti par le finally dans restoreSession()
    }
  }
})
