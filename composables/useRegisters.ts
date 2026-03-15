import { ref, type Ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'
import type { Establishment } from '@/composables/useEstablishments'

export interface Register {
  id: number
  establishmentId: number
  name: string
  isActive: boolean
}

type ApiRegister = Omit<Register, 'isActive'> & { isActive: boolean | null }

export function useRegisters(establishments: Ref<Establishment[]>) {
  const toast = useToast()

  const registers = ref<Register[]>([])

  const addRegisterDialogOpen = ref(false)
  const editRegisterDialogOpen = ref(false)
  const deleteRegisterDialogOpen = ref(false)

  const newRegister = ref({
    name: '',
    isActive: true,
  })

  const editRegister = ref({
    id: 0,
    establishmentId: 0,
    name: '',
    isActive: true,
  })

  const selectedRegister = ref<Register | null>(null)
  const selectedEstablishmentForRegister = ref<Establishment | null>(null)

  async function loadRegisters() {
    try {
      const response = await $fetch<{ registers: any[] }>('/api/registers')
      registers.value = response.registers.map(
        (register): Register => ({
          id: register.id,
          establishmentId: register.establishmentId,
          name: register.name,
          isActive: register.isActive ?? true,
        })
      )
    } catch (error) {
      console.error('Erreur lors du chargement des caisses:', error)
    }
  }

  function getRegistersByEstablishment(establishmentId: number): Register[] {
    return registers.value.filter(r => r.establishmentId === establishmentId)
  }

  function openAddRegisterDialog(establishment: Establishment) {
    selectedEstablishmentForRegister.value = establishment
    newRegister.value = {
      name: '',
      isActive: true,
    }
    addRegisterDialogOpen.value = true
  }

  async function createRegister() {
    if (!selectedEstablishmentForRegister.value || !newRegister.value.name.trim()) {
      toast.error('Le nom de la caisse est obligatoire')
      return
    }

    try {
      await $fetch('/api/registers/create', {
        method: 'POST',
        body: {
          establishmentId: selectedEstablishmentForRegister.value.id,
          name: newRegister.value.name,
          isActive: newRegister.value.isActive,
        },
      })

      toast.success('Caisse créée avec succès')
      addRegisterDialogOpen.value = false
      await loadRegisters()
    } catch (error: unknown) {
      console.error('Erreur lors de la création de la caisse:', error)
      toast.error(extractFetchError(error, 'Impossible de créer la caisse'))
    }
  }

  function openEditRegisterDialog(register: Register) {
    editRegister.value = {
      id: register.id,
      establishmentId: register.establishmentId,
      name: register.name,
      isActive: register.isActive,
    }
    editRegisterDialogOpen.value = true
  }

  async function updateRegister() {
    if (!editRegister.value.name.trim()) {
      toast.error('Le nom de la caisse est obligatoire')
      return
    }

    try {
      await $fetch(`/api/registers/${editRegister.value.id}/update`, {
        method: 'PATCH',
        body: {
          name: editRegister.value.name,
          isActive: editRegister.value.isActive,
        },
      })

      toast.success('Caisse modifiée avec succès')
      editRegisterDialogOpen.value = false
      await loadRegisters()
    } catch (error: unknown) {
      console.error('Erreur lors de la modification de la caisse:', error)
      toast.error(extractFetchError(error, 'Impossible de modifier la caisse'))
    }
  }

  async function toggleRegisterStatus(register: Register) {
    try {
      await $fetch(`/api/registers/${register.id}/update`, {
        method: 'PATCH',
        body: {
          isActive: !register.isActive,
        },
      })

      toast.success(register.isActive ? 'Caisse désactivée' : 'Caisse activée')
      await loadRegisters()
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error)
      toast.error('Impossible de changer le statut')
    }
  }

  function openDeleteRegisterDialog(register: Register) {
    selectedRegister.value = register
    deleteRegisterDialogOpen.value = true
  }

  async function deleteRegister() {
    if (!selectedRegister.value) return

    try {
      await $fetch(`/api/registers/${selectedRegister.value.id}/delete`, {
        method: 'DELETE',
      })

      toast.success('Caisse désactivée avec succès')
      deleteRegisterDialogOpen.value = false
      await loadRegisters()
    } catch (error) {
      console.error('Erreur lors de la suppression de la caisse:', error)
      toast.error('Impossible de supprimer la caisse')
    }
  }

  return {
    registers,
    addRegisterDialogOpen,
    editRegisterDialogOpen,
    deleteRegisterDialogOpen,
    newRegister,
    editRegister,
    selectedRegister,
    selectedEstablishmentForRegister,
    loadRegisters,
    getRegistersByEstablishment,
    openAddRegisterDialog,
    createRegister,
    openEditRegisterDialog,
    updateRegister,
    toggleRegisterStatus,
    openDeleteRegisterDialog,
    deleteRegister,
  }
}
