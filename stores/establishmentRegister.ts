import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { EstablishmentDetail } from '@/types/pos'

const ESTABLISHMENT_KEY_PREFIX = 'pos_selected_establishment'
const REGISTER_KEY_PREFIX = 'pos_selected_register'

function scopedKey(prefix: string, tenantId: string | null): string | null {
  return tenantId ? `${prefix}_${tenantId}` : null
}

// Supprime les anciennes clés non-scopées — un user A / user B sur le même navigateur
// se voyait hériter de la sélection de l'autre. Migration one-shot au premier init.
function cleanupLegacyKeys() {
  if (!process.client) return
  localStorage.removeItem(ESTABLISHMENT_KEY_PREFIX)
  localStorage.removeItem(REGISTER_KEY_PREFIX)
}

// Types internes au store : volontairement NON exportés pour ne pas entrer en collision
// avec l'auto-import Nuxt de `Establishment` / `Register` (sources canoniques :
// `composables/useEstablishments.ts` et `composables/useRegisters.ts`).
interface Establishment {
  id: number
  name: string
  city: string | null
  isActive: boolean
}

interface Register {
  id: number
  establishmentId: number
  name: string
  isActive: boolean
}

// Formes brutes renvoyées par l'API (isActive éventuellement absent/null).
interface RawEstablishment {
  id: number
  name: string
  city: string | null
  isActive?: boolean | null
}

interface RawRegister {
  id: number
  establishmentId: number
  name: string
  isActive?: boolean | null
}

/**
 * Store de sélection établissement / caisse.
 *
 * Remplace l'ancien singleton module-level (`composables/useEstablishmentRegister.ts`,
 * qui reste comme wrapper d'API). La sélection est persistée dans localStorage scopée
 * par `tenantId` et hydratée au démarrage. Le reset au signOut passe par `$reset`
 * (cf. `stores/auth.ts`, invariant CLAUDE.md n°5).
 */
export const useEstablishmentRegisterStore = defineStore('establishmentRegister', () => {
  // State
  const establishments = ref<Establishment[]>([])
  const allRegisters = ref<Register[]>([])
  const selectedEstablishmentId = ref<number | null>(null)
  const selectedRegisterId = ref<number | null>(null)
  const selectedEstablishmentDetail = ref<EstablishmentDetail | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  // Computed
  const selectedEstablishment = computed(() => {
    if (!selectedEstablishmentId.value) return null
    return establishments.value.find(e => e.id === selectedEstablishmentId.value) || null
  })

  const selectedRegister = computed(() => {
    if (!selectedRegisterId.value) return null
    return allRegisters.value.find(r => r.id === selectedRegisterId.value) || null
  })

  const availableRegisters = computed(() => {
    if (!selectedEstablishmentId.value) return []
    return allRegisters.value.filter(r => r.establishmentId === selectedEstablishmentId.value)
  })

  // Charger les données
  async function loadEstablishments() {
    try {
      const response = await $fetch<{ establishments: RawEstablishment[] }>('/api/establishments')
      establishments.value = response.establishments.map((e): Establishment => ({
        id: e.id,
        name: e.name,
        city: e.city,
        isActive: e.isActive ?? true,
      }))
    } catch (error) {
      console.error('Erreur lors du chargement des établissements:', error)
    }
  }

  async function fetchCurrentEstablishmentDetail() {
    if (!selectedEstablishmentId.value) {
      selectedEstablishmentDetail.value = null
      return
    }
    try {
      const response = await $fetch<{ success: boolean; establishment: EstablishmentDetail }>(
        `/api/establishments/${selectedEstablishmentId.value}`
      )
      if (response.success) {
        selectedEstablishmentDetail.value = response.establishment
      }
    } catch (error) {
      console.error('Erreur lors du chargement du détail établissement:', error)
      selectedEstablishmentDetail.value = null
    }
  }

  async function loadRegisters() {
    try {
      const response = await $fetch<{ registers: RawRegister[] }>('/api/registers')
      allRegisters.value = response.registers.map((r): Register => ({
        id: r.id,
        establishmentId: r.establishmentId,
        name: r.name,
        isActive: r.isActive ?? true,
      }))
    } catch (error) {
      console.error('Erreur lors du chargement des caisses:', error)
    }
  }

  // Sauvegarder les sélections dans localStorage (scopé par tenantId)
  function saveSelections() {
    if (!process.client) return
    const tenantId = useAuthStore().tenantId
    const estKey = scopedKey(ESTABLISHMENT_KEY_PREFIX, tenantId)
    const regKey = scopedKey(REGISTER_KEY_PREFIX, tenantId)
    if (!estKey || !regKey) return // pas de tenant → ne rien écrire (évite fuite cross-tenant)

    if (selectedEstablishmentId.value) {
      localStorage.setItem(estKey, String(selectedEstablishmentId.value))
    }
    if (selectedRegisterId.value) {
      localStorage.setItem(regKey, String(selectedRegisterId.value))
    }
  }

  // Hydrate rapidement depuis le storage (avant le fetch) pour afficher l'info dès le chargement.
  // Appelé depuis initialize() — à ce moment plugins/02.session-restore.client.ts a déjà
  // restauré la session, donc useAuthStore().tenantId est défini pour un user authentifié.
  function hydrateSelectionsFromStorage() {
    if (!process.client) return
    const tenantId = useAuthStore().tenantId
    const estKey = scopedKey(ESTABLISHMENT_KEY_PREFIX, tenantId)
    const regKey = scopedKey(REGISTER_KEY_PREFIX, tenantId)
    if (!estKey || !regKey) return

    const savedEstablishmentId = localStorage.getItem(estKey)
    const savedRegisterId = localStorage.getItem(regKey)

    if (savedEstablishmentId) {
      selectedEstablishmentId.value = Number(savedEstablishmentId)
    }
    if (savedRegisterId) {
      selectedRegisterId.value = Number(savedRegisterId)
    }
  }

  // Valide/ajuste les sélections après chargement des données
  function ensureValidSelections() {
    // Établissement
    if (!selectedEstablishmentId.value || !establishments.value.some(e => e.id === selectedEstablishmentId.value)) {
      const firstEstablishment = establishments.value[0]
      selectedEstablishmentId.value = firstEstablishment ? firstEstablishment.id : null
    }

    // Caisse
    if (!selectedRegisterId.value || !allRegisters.value.some(r => r.id === selectedRegisterId.value)) {
      const firstRegister = availableRegisters.value[0]
      selectedRegisterId.value = firstRegister ? firstRegister.id : null
    }
  }

  // Initialiser les données
  async function initialize() {
    if (initialized.value) return

    loading.value = true
    cleanupLegacyKeys()
    // Pré-hydrate depuis le storage pour un affichage instantané
    hydrateSelectionsFromStorage()
    await Promise.all([
      loadEstablishments(),
      loadRegisters(),
    ])
    ensureValidSelections()
    await fetchCurrentEstablishmentDetail()
    loading.value = false
    initialized.value = true
  }

  // Watcher pour sauvegarder les changements
  watch([selectedEstablishmentId, selectedRegisterId], () => {
    if (initialized.value) {
      saveSelections()
    }
  })

  // Recharger le détail complet quand l'établissement sélectionné change
  watch(selectedEstablishmentId, () => {
    if (initialized.value) {
      fetchCurrentEstablishmentDetail()
    }
  })

  // Watcher pour réinitialiser la caisse si l'établissement change
  watch(selectedEstablishmentId, (newEstablishmentId) => {
    if (!newEstablishmentId || !initialized.value) return

    // Si la caisse sélectionnée n'appartient pas au nouvel établissement, la réinitialiser
    if (selectedRegisterId.value) {
      const currentRegister = allRegisters.value.find(r => r.id === selectedRegisterId.value)
      if (currentRegister && currentRegister.establishmentId !== newEstablishmentId) {
        // Sélectionner la première caisse disponible du nouvel établissement
        const newAvailableRegisters = allRegisters.value.filter(r => r.establishmentId === newEstablishmentId)
        const firstAvailableRegister = newAvailableRegisters[0]
        selectedRegisterId.value = firstAvailableRegister ? firstAvailableRegister.id : null
      }
    } else {
      // Sélectionner la première caisse disponible
      const newAvailableRegisters = allRegisters.value.filter(r => r.establishmentId === newEstablishmentId)
      const firstAvailableRegister = newAvailableRegisters[0]
      selectedRegisterId.value = firstAvailableRegister ? firstAvailableRegister.id : null
    }
  })

  // Réinitialise le store pour forcer un rechargement (ex: après changement d'utilisateur).
  // Surcharge le `$reset` standard de Pinia (les setup stores n'en fournissent pas par défaut) :
  // appelé par `stores/auth.ts:signOut()` (invariant CLAUDE.md n°5). On conserve volontairement
  // les sélections d'IDs — elles sont re-validées (et ré-hydratées par tenant) au prochain
  // initialize().
  function $reset() {
    initialized.value = false
    establishments.value = []
    allRegisters.value = []
    selectedEstablishmentDetail.value = null
  }

  return {
    // State
    establishments,
    allRegisters,
    selectedEstablishmentId,
    selectedRegisterId,
    selectedEstablishmentDetail,
    loading,
    initialized,

    // Computed
    selectedEstablishment,
    selectedRegister,
    availableRegisters,

    // Methods
    initialize,
    loadEstablishments,
    loadRegisters,
    fetchCurrentEstablishmentDetail,
    $reset,
  }
})
