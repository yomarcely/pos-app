import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useClientEditor } from '@/composables/useClientEditor'
import { useClientPurchaseHistory } from '@/composables/useClientPurchaseHistory'
import { usePostalCodeLookup } from '@/composables/usePostalCodeLookup'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() })
}))

vi.stubGlobal('navigateTo', vi.fn())

const fetchMock = vi.fn()

describe('useClientEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('loadClient() appelle GET /api/clients/:id', async () => {
    fetchMock.mockResolvedValueOnce({
      client: { firstName: 'Jean', lastName: 'Dupont', gdprConsent: true, discount: '0', metadata: {} }
    })
    fetchMock.mockResolvedValueOnce({ totalRevenue: 0, loyaltyPoints: 0, purchaseCount: 0 })
    const { loadClient } = useClientEditor(ref(42))
    await loadClient()
    expect(fetchMock).toHaveBeenCalledWith('/api/clients/42')
  })

  it('loadClientStats() appelle GET /api/clients/:id/stats', async () => {
    fetchMock.mockResolvedValueOnce({
      client: { firstName: 'Jean', lastName: 'Dupont', gdprConsent: true, discount: '0', metadata: {} }
    })
    fetchMock.mockResolvedValueOnce({ totalRevenue: 100, loyaltyPoints: 10, purchaseCount: 5 })
    const { loadClient, clientStats } = useClientEditor(ref(42))
    await loadClient()
    expect(fetchMock).toHaveBeenCalledWith('/api/clients/42/stats')
    expect(clientStats.value.totalRevenue).toBe(100)
  })

  it('handleSubmit() appelle PUT /api/clients/:id', async () => {
    fetchMock.mockResolvedValueOnce({
      client: { firstName: 'Jean', lastName: 'Dupont', gdprConsent: true, discount: '0', metadata: {} }
    })
    fetchMock.mockResolvedValueOnce({ totalRevenue: 0, loyaltyPoints: 0, purchaseCount: 0 })
    fetchMock.mockResolvedValueOnce({})
    const { loadClient, handleSubmit, form } = useClientEditor(ref(42))
    await loadClient()
    form.value.gdprConsent = true
    await handleSubmit()
    expect(fetchMock).toHaveBeenCalledWith('/api/clients/42', expect.objectContaining({ method: 'PUT' }))
  })

  it('handleSubmit() ne soumet pas si gdprConsent est false', async () => {
    fetchMock.mockResolvedValueOnce({
      client: { firstName: 'Jean', lastName: 'Dupont', gdprConsent: false, discount: '0', metadata: {} }
    })
    fetchMock.mockResolvedValueOnce({ totalRevenue: 0, loyaltyPoints: 0, purchaseCount: 0 })
    const { loadClient, handleSubmit } = useClientEditor(ref(42))
    await loadClient()
    fetchMock.mockReset()
    await handleSubmit()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('useClientPurchaseHistory', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('appelle GET /api/clients/:id/purchases quand showPurchaseHistory passe à true', async () => {
    fetchMock.mockResolvedValueOnce({ purchases: [{ id: 1 }] })
    const { showPurchaseHistory, purchases } = useClientPurchaseHistory(ref(42))
    showPurchaseHistory.value = true
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchMock).toHaveBeenCalledWith('/api/clients/42/purchases')
  })
})

describe('usePostalCodeLookup', () => {
  it('selectCity() met à jour form.city et vide availableCities', () => {
    const form = ref<any>({ city: '', postalCode: '' })
    const { selectCity, availableCities } = usePostalCodeLookup(form)
    availableCities.value = [{ nom: 'Paris', code: '75001' }, { nom: 'Montreuil', code: '93100' }]
    selectCity('Paris')
    expect(form.value.city).toBe('Paris')
    expect(availableCities.value).toHaveLength(0)
  })
})
