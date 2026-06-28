import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { useSupabaseClient } from '@/composables/useSupabaseClient'
import { useSellersStore } from '@/stores/sellers'
import { useOnboardingStore } from '@/stores/onboarding'
import { useEstablishmentRegisterStore } from '@/stores/establishmentRegister'
import { purgeAllPersistedCarts } from '@/utils/cartPersistence'
import type { Tenant, AuthError } from '@/types'

const extractTenants = (user: User | null, fallbackTenant?: string) => {
  const meta = (user?.app_metadata || user?.user_metadata || {}) as Record<string, unknown>

  const tenants: Tenant[] = Array.isArray(meta.tenants)
    ? meta.tenants.map((tenant) => ({
        id: String(tenant.id ?? tenant.tenant_id ?? tenant.slug ?? tenant.name ?? tenant),
        name: tenant.name,
        slug: tenant.slug,
      }))
    : []

  const explicitTenant = meta.tenant_id || meta.tenantId
  const userAsTenant = user?.id ? String(user.id) : null

  const firstTenantId = tenants[0]?.id

  const tenantId = explicitTenant
    ? String(explicitTenant)
    : firstTenantId || userAsTenant || fallbackTenant || null

  // Si pas de liste fournie, on expose au moins le tenant utilisateur
  const enrichedTenants = tenants.length > 0
    ? tenants
    : userAsTenant
      ? [{ id: userAsTenant, name: 'Mon espace' }]
      : tenants

  return { tenants: enrichedTenants, tenantId }
}

export const useAuthStore = defineStore('auth', () => {
  let supabase: ReturnType<typeof useSupabaseClient> | null = null
  try {
    supabase = useSupabaseClient()
  } catch {
    console.warn('[Auth] Supabase non configuré — mode dégradé actif (vérifiez vos variables d\'environnement)')
  }

  const requireSupabase = () => {
    if (!supabase) throw new Error('Supabase non configuré — vérifiez vos variables d\'environnement')
    return supabase
  }

  const config = useRuntimeConfig()

  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const tenantId = ref<string | null>(null)
  const tenants = ref<Tenant[]>([])
  const loading = ref(false)
  const error = ref<AuthError | null>(null)
  // Devient true après le premier appel à restoreSession — évite le flash du dashboard avant redirect
  const sessionRestored = ref(false)

  const isAuthenticated = computed(() => Boolean(session.value?.access_token))
  const accessToken = computed(() => session.value?.access_token || null)

  const setUserContext = (nextUser: User | null) => {
    user.value = nextUser
    const { tenants: availableTenants, tenantId: selectedTenant } = extractTenants(
      nextUser,
      config.public.defaultTenantId
    )
    tenants.value = availableTenants
    tenantId.value = selectedTenant
  }

  const signUp = async (email: string, password: string, name: string) => {
    loading.value = true
    error.value = null
    try {
      const { data, error: signUpError } = await requireSupabase().auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (signUpError) throw signUpError
      if (!data.user) throw new Error('Compte créé mais utilisateur non retourné')

      session.value = data.session
      setUserContext(data.user)

      return data.user
    } catch (err: unknown) {
      console.error('[Auth] signUp error', err)
      error.value = { message: err instanceof Error ? err.message : 'Erreur lors de la création du compte' }
      throw err
    } finally {
      loading.value = false
    }
  }

  const signIn = async (email: string, password: string) => {
    loading.value = true
    error.value = null
    try {
      const { data, error: signInError } = await requireSupabase().auth.signInWithPassword({ email, password })
      if (signInError) {
        throw signInError
      }

      session.value = data.session
      setUserContext(data.user || data.session?.user || null)

      return data.user
    } catch (err: unknown) {
      console.error('[Auth] signIn error', err)
      error.value = { message: err instanceof Error ? err.message : 'Échec de connexion' }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * @param options.sessionExpired true = déconnexion subie (token expiré, 401).
   *   Dans ce cas on conserve le panier persisté pour que le même caissier le
   *   retrouve après re-login (P2.1). Par défaut (déconnexion volontaire) :
   *   purge totale, pas de fuite vers le prochain utilisateur.
   */
  const signOut = async (options: { sessionExpired?: boolean } = {}) => {
    loading.value = true
    error.value = null
    try {
      const { error: signOutError } = await requireSupabase().auth.signOut()
      if (signOutError) {
        // Erreur Supabase (ex: token déjà expiré) — on log mais on nettoie quand même l'état local
        console.error('[Auth] signOut returned error', signOutError)
        error.value = { message: signOutError.message }
      }
    } catch (err: unknown) {
      console.error('[Auth] signOut threw', err)
      error.value = { message: err instanceof Error ? err.message : 'Échec de déconnexion' }
    } finally {
      // Toujours nettoyer l'état local, même si Supabase a échoué
      session.value = null
      user.value = null
      tenantId.value = null
      tenants.value = []
      loading.value = false
      useSellersStore().clearSeller()
      // Réinitialiser les données d'établissements pour le prochain utilisateur (mécanique Pinia $reset)
      useEstablishmentRegisterStore().$reset()
      useOnboardingStore().reset()
      // Purge des paniers/paiements persistés (tous tenants) — pas de fuite vers le
      // prochain user. Sautée si la session a simplement expiré : on garde le panier.
      if (!options.sessionExpired) {
        purgeAllPersistedCarts()
      }
    }
  }

  /**
   * Tente de rafraîchir le token via Supabase. Retourne true si une nouvelle
   * session valide a été obtenue, false sinon (refresh token expiré/réseau).
   * Ne lève jamais : l'appelant (plugin api-fetch) décide quoi faire de l'échec.
   */
  const refreshSession = async (): Promise<boolean> => {
    if (!supabase) return false
    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !data.session) {
        console.warn('[Auth] refreshSession failed', refreshError)
        return false
      }
      session.value = data.session
      setUserContext(data.session.user ?? null)
      return true
    } catch (err: unknown) {
      console.error('[Auth] refreshSession threw', err)
      return false
    }
  }

  const restoreSession = async () => {
    try {
      const { data, error: sessionError } = await requireSupabase().auth.getSession()
      if (sessionError) {
        // Distingue "erreur réseau / Supabase indisponible" de "pas de session"
        console.error('[Auth] restoreSession: network/Supabase error', sessionError)
        error.value = { message: sessionError.message }
        // On throw pour que le middleware puisse différencier les deux cas
        throw sessionError
      }
      session.value = data.session
      setUserContext(data.session?.user || null)
      return data.session // null = pas de session active (cas normal)
    } finally {
      sessionRestored.value = true
    }
  }

  const selectTenant = (id: string) => {
    tenantId.value = id
  }

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {}
    if (accessToken.value) {
      headers.Authorization = `Bearer ${accessToken.value}`
    }
    if (tenantId.value) {
      headers['x-tenant-id'] = tenantId.value
    }
    return headers
  }

  supabase?.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    setUserContext(newSession?.user || null)
  })

  return {
    user,
    session,
    tenants,
    tenantId,
    loading,
    error,
    isAuthenticated,
    accessToken,
    sessionRestored,
    signUp,
    signIn,
    signOut,
    refreshSession,
    restoreSession,
    selectTenant,
    getAuthHeaders,
  }
})
