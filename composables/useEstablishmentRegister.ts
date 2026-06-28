import { storeToRefs } from 'pinia'
import { useEstablishmentRegisterStore } from '@/stores/establishmentRegister'

// Wrapper de compatibilité autour de `stores/establishmentRegister.ts`.
// L'état vit désormais dans un store Pinia (plus de singleton module-level) ; ce
// composable conserve l'API publique historique (refs + fonctions) pour les ~10
// consommateurs. `storeToRefs` rend les champs d'état/getters sous forme de refs
// (écritures comprises pour l'état), de sorte que `selectedEstablishmentId.value = …`
// continue de fonctionner à l'identique.
//
// Les types `Establishment` / `Register` vivent désormais dans le store ; aucun consommateur
// ne les importait depuis ce composable (l'auto-import Nuxt les résolvait déjà ailleurs).

export function useEstablishmentRegister() {
  const store = useEstablishmentRegisterStore()
  const {
    establishments,
    allRegisters,
    selectedEstablishmentId,
    selectedRegisterId,
    selectedEstablishmentDetail,
    loading,
    selectedEstablishment,
    selectedRegister,
    availableRegisters,
  } = storeToRefs(store)

  return {
    // State
    establishments,
    allRegisters,
    selectedEstablishmentId,
    selectedRegisterId,
    selectedEstablishmentDetail,
    loading,

    // Computed
    selectedEstablishment,
    selectedRegister,
    availableRegisters,

    // Methods
    initialize: store.initialize,
    loadEstablishments: store.loadEstablishments,
    loadRegisters: store.loadRegisters,
    fetchCurrentEstablishmentDetail: store.fetchCurrentEstablishmentDetail,
    reset: store.$reset,
  }
}
