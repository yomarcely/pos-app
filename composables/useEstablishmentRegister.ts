import { ref, computed, watch } from 'vue'

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
    if (selectedEstablishmentId.value) {
      localStorage.setItem('pos_selected_establishment', String(selectedEstablishmentId.value))
    }
    if (selectedRegisterId.value) {
      localStorage.setItem('pos_selected_register', String(selectedRegisterId.value))
    }
  }

  // Restaurer les sélections depuis localStorage
  function restoreSelections() {
    const savedEstablishmentId = localStorage.getItem('pos_selected_establishment')
    const savedRegisterId = localStorage.getItem('pos_selected_register')

    if (savedEstablishmentId) {
      const id = Number(savedEstablishmentId)
      if (establishments.value.find(e => e.id === id)) {
        selectedEstablishmentId.value = id
      }
    }

    if (savedRegisterId) {
      const id = Number(savedRegisterId)
      if (allRegisters.value.find(r => r.id === id)) {
        selectedRegisterId.value = id
      }
    }

    // Si rien n'est sélectionné, sélectionner le premier disponible
    if (!selectedEstablishmentId.value && establishments.value.length > 0) {
      const firstEstablishment = establishments.value[0]
      if (firstEstablishment) {
        selectedEstablishmentId.value = firstEstablishment.id
      }
    }

    if (!selectedRegisterId.value && availableRegisters.value.length > 0) {
      const firstRegister = availableRegisters.value[0]
      if (firstRegister) {
        selectedRegisterId.value = firstRegister.id
      }
    }
  }

  // Initialiser les données
  async function initialize() {
    if (initialized.value) return

    loading.value = true
    await Promise.all([
      loadEstablishments(),
      loadRegisters(),
    ])
    restoreSelections()
    loading.value = false
    initialized.value = true
  }

  // Watcher pour sauvegarder les changements
  watch([selectedEstablishmentId, selectedRegisterId], () => {
    if (initialized.value) {
      saveSelections()
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

  return {
    // State
    establishments,
    allRegisters,
    selectedEstablishmentId,
    selectedRegisterId,
    loading,

    // Computed
    selectedEstablishment,
    selectedRegister,
    availableRegisters,

    // Methods
    initialize,
    loadEstablishments,
    loadRegisters,
  }
}
