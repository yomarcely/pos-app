import { ref, watch } from 'vue'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useAuthStore } from '@/stores/auth'
import { autoPrintStorageKey, readPersisted, writePersisted } from '@/utils/cartPersistence'

/**
 * Préférence « impression automatique du ticket » à la validation de la vente.
 *
 * - Persistée en localStorage, scopée par caisse (tenant + register).
 * - Activée par défaut (true) quand aucune préférence n'est encore enregistrée.
 * - Rechargée automatiquement au changement de caisse.
 */
export function useAutoPrintPreference() {
  const { selectedRegisterId } = useEstablishmentRegister()
  const autoPrint = ref(true)

  function storageKey(): string | null {
    try {
      const tenantId = useAuthStore().tenantId
      if (!tenantId || !selectedRegisterId.value) return null
      return autoPrintStorageKey(tenantId, selectedRegisterId.value)
    } catch {
      return null
    }
  }

  function load() {
    const key = storageKey()
    if (!key) {
      autoPrint.value = true
      return
    }
    const saved = readPersisted<boolean>(key)
    autoPrint.value = typeof saved === 'boolean' ? saved : true
  }

  // Charge la préférence persistée (et la recharge si la caisse change)
  load()
  watch(selectedRegisterId, load)

  // Persiste à chaque modification
  watch(autoPrint, (value) => {
    const key = storageKey()
    if (key) writePersisted(key, value)
  })

  return { autoPrint }
}
