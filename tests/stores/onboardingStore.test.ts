import { setActivePinia, createPinia } from 'pinia'
import { useOnboardingStore, type OnboardingStatus } from '@/stores/onboarding'

const mockAuth = { tenantId: null as string | null }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth,
}))

function statusFixture(overrides: Partial<OnboardingStatus> = {}): OnboardingStatus {
  return {
    hasEstablishment: false,
    hasRegister: false,
    hasSeller: false,
    hasTaxRate: false,
    hasProduct: false,
    isComplete: false,
    progress: { done: 0, total: 5 },
    ...overrides,
  }
}

describe('stores/onboarding', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockAuth.tenantId = 'tenant-A'
    ;(process as unknown as { client: boolean }).client = true
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchStatus charge le statut depuis l\'API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(statusFixture({ hasSeller: true, progress: { done: 1, total: 5 } }))
    vi.stubGlobal('$fetch', fetchMock)

    const store = useOnboardingStore()
    const res = await store.fetchStatus()

    expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/status')
    expect(res?.hasSeller).toBe(true)
    expect(store.status?.hasSeller).toBe(true)
    expect(store.progress).toEqual({ done: 1, total: 5 })
  })

  it('fetchStatus capture l\'erreur sans throw', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('500'))
    vi.stubGlobal('$fetch', fetchMock)

    const store = useOnboardingStore()
    const res = await store.fetchStatus()

    expect(res).toBeNull()
    expect(store.error).toBe('500')
  })

  it('ensureSeeded appelle POST /seed quand vendeur OU TVA manquent', async () => {
    const fetchMock = vi.fn()
      // 1er appel : fetchStatus initial → vendeur absent
      .mockResolvedValueOnce(statusFixture())
      // 2e appel : POST /seed
      .mockResolvedValueOnce({ success: true, created: { seller: true, taxRates: 3, sellerAttachments: 0 }, alreadySeeded: false, errors: [] })
      // 3e appel : refetch statut après seed
      .mockResolvedValueOnce(statusFixture({ hasSeller: true, hasTaxRate: true, progress: { done: 2, total: 5 } }))
    vi.stubGlobal('$fetch', fetchMock)

    const store = useOnboardingStore()
    await store.ensureSeeded()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/onboarding/seed', { method: 'POST' })
    expect(store.status?.hasSeller).toBe(true)
    expect(store.status?.hasTaxRate).toBe(true)
    expect(store.lastSeedResult?.success).toBe(true)
  })

  it('runSeed expose les erreurs serveur pour permettre un retry visible', async () => {
    const fetchMock = vi.fn()
      // POST /seed → erreur sur le vendeur
      .mockResolvedValueOnce({ success: false, created: { seller: false, taxRates: 3, sellerAttachments: 0 }, alreadySeeded: false, errors: ['seller: insert failed'] })
      // refetch statut
      .mockResolvedValueOnce(statusFixture({ hasTaxRate: true, progress: { done: 1, total: 5 } }))
    vi.stubGlobal('$fetch', fetchMock)

    const store = useOnboardingStore()
    const res = await store.runSeed()

    expect(res?.success).toBe(false)
    expect(res?.errors).toContain('seller: insert failed')
    expect(store.lastSeedResult?.success).toBe(false)
  })

  it('ensureSeeded ne re-seed pas si vendeur ET TVA présents', async () => {
    const fetchMock = vi.fn().mockResolvedValue(statusFixture({ hasSeller: true, hasTaxRate: true }))
    vi.stubGlobal('$fetch', fetchMock)

    const store = useOnboardingStore()
    await store.fetchStatus()
    await store.ensureSeeded()

    // 1 seul appel : fetchStatus initial — pas de POST seed
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('setSkipped persiste dans localStorage scopé au tenant', () => {
    const store = useOnboardingStore()
    store.setSkipped(true)

    expect(localStorage.getItem('onboarding_wizard_skipped_tenant-A')).toBe('1')
    expect(store.wizardSkipped).toBe(true)

    store.setSkipped(false)
    expect(localStorage.getItem('onboarding_wizard_skipped_tenant-A')).toBeNull()
  })

  it('readSkipped relit la valeur depuis localStorage', () => {
    localStorage.setItem('onboarding_wizard_skipped_tenant-A', '1')

    const store = useOnboardingStore()
    store.readSkipped()

    expect(store.wizardSkipped).toBe(true)
  })

  it('shouldShowWizard est false si onboarding complet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      statusFixture({ hasEstablishment: true, hasSeller: true, hasTaxRate: true, hasProduct: true, isComplete: true, progress: { done: 4, total: 4 } })
    )
    vi.stubGlobal('$fetch', fetchMock)

    const store = useOnboardingStore()
    await store.fetchStatus()

    expect(store.isComplete).toBe(true)
    expect(store.shouldShowWizard).toBe(false)
  })

  it('shouldShowWizard est false si skipped, même si incomplet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(statusFixture())
    vi.stubGlobal('$fetch', fetchMock)

    const store = useOnboardingStore()
    await store.fetchStatus()
    store.setSkipped(true)

    expect(store.shouldShowWizard).toBe(false)
  })

  it('reset() remet tout à zéro', async () => {
    const fetchMock = vi.fn().mockResolvedValue(statusFixture({ hasSeller: true }))
    vi.stubGlobal('$fetch', fetchMock)

    const store = useOnboardingStore()
    await store.fetchStatus()
    store.setSkipped(true)

    store.reset()
    expect(store.status).toBeNull()
    expect(store.wizardSkipped).toBe(false)
    expect(store.error).toBeNull()
  })
})
