import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useEstablishments } from '@/composables/useEstablishments'
import { useRegisters } from '@/composables/useRegisters'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() })
}))

const fetchMock = vi.fn()

describe('useEstablishments', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('loadEstablishments() appelle GET /api/establishments', async () => {
    fetchMock.mockResolvedValue({ establishments: [] })
    const { loadEstablishments } = useEstablishments()
    await loadEstablishments()
    expect(fetchMock).toHaveBeenCalledWith('/api/establishments', { query: { includeInactive: 'true' } })
  })

  it('createEstablishment() appelle POST /api/establishments/create', async () => {
    fetchMock.mockResolvedValue({ establishments: [] })
    const { createEstablishment, newEstablishment } = useEstablishments()
    newEstablishment.value.name = 'Mon établissement'
    await createEstablishment()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/establishments/create',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('deleteEstablishment() appelle DELETE /api/establishments/:id/delete', async () => {
    fetchMock.mockResolvedValue({ establishments: [] })
    const { deleteEstablishment, selectedEstablishment } = useEstablishments()
    selectedEstablishment.value = { id: 42, name: 'Test', address: null, postalCode: null, city: null, country: null, phone: null, email: null, siret: null, naf: null, tvaNumber: null, isActive: true }
    await deleteEstablishment()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/establishments/42/delete',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})

describe('useRegisters', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('loadRegisters() appelle GET /api/registers', async () => {
    fetchMock.mockResolvedValue({ registers: [] })
    const establishments = ref<any[]>([])
    const { loadRegisters } = useRegisters(establishments)
    await loadRegisters()
    expect(fetchMock).toHaveBeenCalledWith('/api/registers')
  })

  it('getRegistersByEstablishment(id) filtre correctement', () => {
    const establishments = ref<any[]>([])
    const { registers, getRegistersByEstablishment } = useRegisters(establishments)
    registers.value = [
      { id: 1, establishmentId: 10, name: 'Caisse 1', isActive: true },
      { id: 2, establishmentId: 20, name: 'Caisse 2', isActive: true },
      { id: 3, establishmentId: 10, name: 'Caisse 3', isActive: true },
    ]
    const result = getRegistersByEstablishment(10)
    expect(result).toHaveLength(2)
    expect(result.every(r => r.establishmentId === 10)).toBe(true)
  })
})
