import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseAnonKey

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] SUPABASE_URL ou SUPABASE_ANON_KEY manquant')
  }

  const isServer = process.server

  const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: !isServer,
        autoRefreshToken: !isServer,
        detectSessionInUrl: !isServer,
      },
      global: {
        fetch: globalThis.fetch,
      },
    })
    : null

  return {
    provide: {
      supabase,
    },
  }
})
