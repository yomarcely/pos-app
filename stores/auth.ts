import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { useSupabaseClient } from '@/composables/useSupabaseClient'
import { useSellersStore } from '@/stores/sellers'

type Tenant = {
  id: string
  name?: string
  slug?: string
}

type AuthError = {
  message: string
}

const extractTenants = (user: User | null, fallbackTenant?: string) => {
  const meta = (user?.app_metadata || user?.user_metadata || {}) as Record<string, any>

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

  const signOut = async () => {
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
    }
  }

  const restoreSession = async () => {
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
    signUp,
    signIn,
    signOut,
    restoreSession,
    selectTenant,
    getAuthHeaders,
  }
})
