import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Invariant CLAUDE.md n°5 : signOut doit purger les singletons ET les paniers persistés.

vi.mock('@/composables/useSupabaseClient', () => ({
  useSupabaseClient: () => ({
    auth: {
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(),
    },
  }),
}))

const clearSeller = vi.hoisted(() => vi.fn())
vi.mock('@/stores/sellers', () => ({ useSellersStore: () => ({ clearSeller }) }))
vi.mock('@/stores/onboarding', () => ({ useOnboardingStore: () => ({ reset: vi.fn() }) }))
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({ reset: vi.fn(), selectedRegisterId: { value: null } }),
}))

;(globalThis as Record<string, unknown>).useRuntimeConfig = () => ({
  public: { defaultTenantId: 'tenant-test' },
})

import { useAuthStore } from '@/stores/auth'

describe('auth store — purge des paniers persistés au signOut', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('signOut supprime toutes les clés fympos-cart-* (panier + paiements)', async () => {
    localStorage.setItem('fympos-cart-tenant-a-1', '{"v":1,"items":[]}')
    localStorage.setItem('fympos-cart-payments-tenant-a-1', '[{"mode":"CB","amount":10}]')
    localStorage.setItem('autre-cle', 'conservée')

    const auth = useAuthStore()
    await auth.signOut()

    expect(localStorage.getItem('fympos-cart-tenant-a-1')).toBeNull()
    expect(localStorage.getItem('fympos-cart-payments-tenant-a-1')).toBeNull()
    expect(localStorage.getItem('autre-cle')).toBe('conservée')
    expect(clearSeller).toHaveBeenCalled()
  })

  it('signOut({ sessionExpired: true }) conserve les paniers (P2.1 : re-login du même caissier)', async () => {
    localStorage.setItem('fympos-cart-tenant-a-1', '{"v":1,"items":[]}')
    localStorage.setItem('fympos-cart-payments-tenant-a-1', '[{"mode":"CB","amount":10}]')

    const auth = useAuthStore()
    await auth.signOut({ sessionExpired: true })

    // L'état local est nettoyé (singletons) mais le panier persisté survit.
    expect(localStorage.getItem('fympos-cart-tenant-a-1')).toBe('{"v":1,"items":[]}')
    expect(localStorage.getItem('fympos-cart-payments-tenant-a-1')).toBe('[{"mode":"CB","amount":10}]')
    expect(clearSeller).toHaveBeenCalled()
  })
})
