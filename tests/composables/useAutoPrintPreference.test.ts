import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'

// Caisse sélectionnée pilotable depuis les tests
const selectedRegisterId = ref<number | null>(1)
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({ selectedRegisterId }),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ tenantId: 'tenant-test' }),
}))

import { useAutoPrintPreference } from '@/composables/useAutoPrintPreference'
import { autoPrintStorageKey } from '@/utils/cartPersistence'

describe('useAutoPrintPreference', () => {
  beforeEach(() => {
    localStorage.clear()
    selectedRegisterId.value = 1
  })

  it('est activée par défaut quand aucune préférence n\'est persistée', () => {
    const { autoPrint } = useAutoPrintPreference()
    expect(autoPrint.value).toBe(true)
  })

  it('persiste la préférence en localStorage (scopée par caisse)', async () => {
    const { autoPrint } = useAutoPrintPreference()
    autoPrint.value = false
    await nextTick()

    const key = autoPrintStorageKey('tenant-test', 1)
    expect(JSON.parse(localStorage.getItem(key)!)).toBe(false)
  })

  it('recharge la préférence persistée à l\'initialisation', () => {
    localStorage.setItem(autoPrintStorageKey('tenant-test', 1), JSON.stringify(false))
    const { autoPrint } = useAutoPrintPreference()
    expect(autoPrint.value).toBe(false)
  })

  it('scope par caisse : la préférence d\'une caisse n\'affecte pas une autre', () => {
    localStorage.setItem(autoPrintStorageKey('tenant-test', 1), JSON.stringify(false))
    selectedRegisterId.value = 2 // autre caisse, sans préférence
    const { autoPrint } = useAutoPrintPreference()
    expect(autoPrint.value).toBe(true)
  })

  it('recharge la préférence au changement de caisse', async () => {
    localStorage.setItem(autoPrintStorageKey('tenant-test', 2), JSON.stringify(false))
    const { autoPrint } = useAutoPrintPreference()
    expect(autoPrint.value).toBe(true) // caisse 1 : pas de préférence

    selectedRegisterId.value = 2
    await nextTick()
    expect(autoPrint.value).toBe(false) // rechargé pour la caisse 2
  })
})
