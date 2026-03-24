import { ref, computed, watch } from 'vue'
import type { EstablishmentDetail } from '@/types/pos'

export interface Establishment {
  id: number
  name: string
  city: string | null
  isActive: boolean
}

export interface Register {
  id: number
  establishmentId: number
  name: string
  isActive: boolean
}

const establishments = ref<Establishment[]>([])
const allRegisters = ref<Register[]>([])
const selectedEstablishmentId = ref<number | null>(null)
const selectedRegisterId = ref<number | null>(null)
const selectedEstablishmentDetail = ref<EstablishmentDetail | null>(null)
const loading = ref(false)
const initialized = ref(false)

export function useEstablishmentRegister() {
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
      const response = await $fetch<{ establishments: any[] }>('/api/establishments')
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
      const response = await $fetch<{ registers: any[] }>('/api/registers')
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

  // Sauvegarder les sélections dans localStorage
  function saveSelections() {
    if (!process.client) return
    if (selectedEstablishmentId.value) {
      localStorage.setItem('pos_selected_establishment', String(selectedEstablishmentId.value))
    }
    if (selectedRegisterId.value) {
      localStorage.setItem('pos_selected_register', String(selectedRegisterId.value))
    }
  }

  // Hydrate rapidement depuis le storage (avant le fetch) pour afficher l'info dès le chargement
  function hydrateSelectionsFromStorage() {
    if (!process.client) return
    const savedEstablishmentId = localStorage.getItem('pos_selected_establishment')
    const savedRegisterId = localStorage.getItem('pos_selected_register')

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

  // Réinitialise le composable pour forcer un rechargement (ex: après changement d'utilisateur)
  function reset() {
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

    // Computed
    selectedEstablishment,
    selectedRegister,
    availableRegisters,

    // Methods
    initialize,
    loadEstablishments,
    loadRegisters,
    fetchCurrentEstablishmentDetail,
    reset,
  }
}
