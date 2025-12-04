import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { useSupabaseClient } from '@/composables/useSupabaseClient'

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
  const supabase = useSupabaseClient()
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

  const signIn = async (email: string, password: string) => {
    loading.value = true
    error.value = null
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        throw signInError
      }

      session.value = data.session
      setUserContext(data.user || data.session?.user || null)

      return data.user
    } catch (err: any) {
      console.error('[Auth] signIn error', err)
      error.value = { message: err?.message || 'Échec de connexion' }
      throw err
    } finally {
      loading.value = false
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
    tenantId.value = null
    tenants.value = []
  }

  const restoreSession = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      console.error('[Auth] restoreSession error', sessionError)
      return null
    }
    session.value = data.session
    setUserContext(data.session?.user || null)
    return data.session
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

  supabase.auth.onAuthStateChange((_event, newSession) => {
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
    signIn,
    signOut,
    restoreSession,
    selectTenant,
    getAuthHeaders,
  }
})
