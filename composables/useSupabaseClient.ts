import type { SupabaseClient } from '@supabase/supabase-js'

export function useSupabaseClient(): SupabaseClient {
  const { $supabase } = useNuxtApp()

  if (!$supabase) {
    throw new Error('Supabase n\'est pas initialisé - vérifiez vos variables d\'environnement')
  }

  return $supabase
}
