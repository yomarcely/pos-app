import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

const mockAuth = { tenantId: null as string | null }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth,
}))

describe('useEstablishmentRegister — localStorage scoping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockAuth.tenantId = null
    // process.client est injecté par Nuxt — absent en vitest, donc on le force.
    ;(process as unknown as { client: boolean }).client = true
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (process as unknown as { client?: boolean }).client
  })

  it('hydrate depuis la clé scopée du tenant courant uniquement', async () => {
    localStorage.setItem('pos_selected_establishment_tenant-a', '42')
    localStorage.setItem('pos_selected_establishment_tenant-b', '99')
    mockAuth.tenantId = 'tenant-a'

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      establishments: [{ id: 42, name: 'A', city: null, isActive: true }],
      registers: [],
      success: true,
      establishment: null,
    }))

    const { useEstablishmentRegister } = await import('@/composables/useEstablishmentRegister')
    const composable = useEstablishmentRegister()
    await composable.initialize()

    expect(composable.selectedEstablishmentId.value).toBe(42)
  })

  it('sauvegarde sous la clé scopée au tenantId', async () => {
    mockAuth.tenantId = 'tenant-a'

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      establishments: [
        { id: 1, name: 'X', city: null, isActive: true },
        { id: 2, name: 'Y', city: null, isActive: true },
      ],
      registers: [{ id: 10, establishmentId: 1, name: 'C1', isActive: true }],
      success: true,
      establishment: null,
    }))

    const { useEstablishmentRegister } = await import('@/composables/useEstablishmentRegister')
    const composable = useEstablishmentRegister()
    await composable.initialize()

    composable.selectedEstablishmentId.value = 2
    await nextTick()
    await nextTick()

    expect(localStorage.getItem('pos_selected_establishment_tenant-a')).toBe('2')
    expect(localStorage.getItem('pos_selected_establishment')).toBeNull()
  })

  it('nettoie les anciennes clés non-scopées au premier init', async () => {
    localStorage.setItem('pos_selected_establishment', '99')
    localStorage.setItem('pos_selected_register', '5')
    mockAuth.tenantId = 'tenant-a'

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      establishments: [], registers: [], success: true, establishment: null,
    }))

    const { useEstablishmentRegister } = await import('@/composables/useEstablishmentRegister')
    await useEstablishmentRegister().initialize()

    expect(localStorage.getItem('pos_selected_establishment')).toBeNull()
    expect(localStorage.getItem('pos_selected_register')).toBeNull()
  })

  it('ne sauve rien si tenantId absent (évite fuite cross-tenant)', async () => {
    mockAuth.tenantId = null

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      establishments: [{ id: 1, name: 'X', city: null, isActive: true }],
      registers: [{ id: 10, establishmentId: 1, name: 'C1', isActive: true }],
      success: true,
      establishment: null,
    }))

    const { useEstablishmentRegister } = await import('@/composables/useEstablishmentRegister')
    const composable = useEstablishmentRegister()
    await composable.initialize()

    composable.selectedEstablishmentId.value = 99
    await nextTick()
    await nextTick()

    expect(localStorage.length).toBe(0)
  })
})
