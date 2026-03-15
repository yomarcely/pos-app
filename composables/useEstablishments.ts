import { ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'

export interface Establishment {
  id: number
  name: string
  address: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  siret: string | null
  naf: string | null
  tvaNumber: string | null
  isActive: boolean
}

type ApiEstablishment = Omit<Establishment, 'isActive'> & { isActive: boolean | null }

export function useEstablishments() {
  const toast = useToast()

  const loading = ref(true)
  const establishments = ref<Establishment[]>([])

  const createDialogOpen = ref(false)
  const editDialogOpen = ref(false)
  const deleteDialogOpen = ref(false)

  const newEstablishment = ref({
    name: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'France',
    phone: '',
    email: '',
    siret: '',
    naf: '',
    tvaNumber: '',
    isActive: true,
  })

  const editEstablishment = ref({
    id: 0,
    name: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    siret: '',
    naf: '',
    tvaNumber: '',
    isActive: true,
  })

  const selectedEstablishment = ref<Establishment | null>(null)

  async function loadEstablishments() {
    try {
      loading.value = true
      const response = await $fetch<{ establishments: ApiEstablishment[] }>('/api/establishments')
      establishments.value = response.establishments.map(
        (establishment): Establishment => ({
          ...establishment,
          isActive: establishment.isActive ?? true,
        })
      )
    } catch (error) {
      console.error('Erreur lors du chargement des établissements:', error)
      toast.error('Erreur lors du chargement des établissements')
    } finally {
      loading.value = false
    }
  }

  function openCreateDialog() {
    newEstablishment.value = {
      name: '',
      address: '',
      postalCode: '',
      city: '',
      country: 'France',
      phone: '',
      email: '',
      siret: '',
      naf: '',
      tvaNumber: '',
      isActive: true,
    }
    createDialogOpen.value = true
  }

  async function createEstablishment() {
    if (!newEstablishment.value.name.trim()) {
      toast.error('Le nom de l\'établissement est obligatoire')
      return
    }

    try {
      await $fetch('/api/establishments/create', {
        method: 'POST',
        body: {
          name: newEstablishment.value.name,
          address: newEstablishment.value.address || null,
          postalCode: newEstablishment.value.postalCode || null,
          city: newEstablishment.value.city || null,
          country: newEstablishment.value.country || 'France',
          phone: newEstablishment.value.phone || null,
          email: newEstablishment.value.email || null,
          siret: newEstablishment.value.siret || null,
          naf: newEstablishment.value.naf || null,
          tvaNumber: newEstablishment.value.tvaNumber || null,
          isActive: newEstablishment.value.isActive,
        },
      })

      toast.success('Établissement créé avec succès')
      createDialogOpen.value = false
      await loadEstablishments()
    } catch (error: unknown) {
      console.error('Erreur lors de la création de l\'établissement:', error)
      toast.error(extractFetchError(error, 'Impossible de créer l\'établissement'))
    }
  }

  function openEditDialog(establishment: Establishment) {
    editEstablishment.value = {
      id: establishment.id,
      name: establishment.name,
      address: establishment.address || '',
      postalCode: establishment.postalCode || '',
      city: establishment.city || '',
      country: establishment.country || '',
      phone: establishment.phone || '',
      email: establishment.email || '',
      siret: establishment.siret || '',
      naf: establishment.naf || '',
      tvaNumber: establishment.tvaNumber || '',
      isActive: establishment.isActive,
    }
    editDialogOpen.value = true
  }

  async function updateEstablishment() {
    if (!editEstablishment.value.name.trim()) {
      toast.error('Le nom de l\'établissement est obligatoire')
      return
    }

    try {
      await $fetch(`/api/establishments/${editEstablishment.value.id}/update`, {
        method: 'PATCH',
        body: {
          name: editEstablishment.value.name,
          address: editEstablishment.value.address || null,
          postalCode: editEstablishment.value.postalCode || null,
          city: editEstablishment.value.city || null,
          country: editEstablishment.value.country || null,
          phone: editEstablishment.value.phone || null,
          email: editEstablishment.value.email || null,
          siret: editEstablishment.value.siret || null,
          naf: editEstablishment.value.naf || null,
          tvaNumber: editEstablishment.value.tvaNumber || null,
          isActive: editEstablishment.value.isActive,
        },
      })

      toast.success('Établissement modifié avec succès')
      editDialogOpen.value = false
      await loadEstablishments()
    } catch (error: unknown) {
      console.error('Erreur lors de la modification de l\'établissement:', error)
      toast.error(extractFetchError(error, 'Impossible de modifier l\'établissement'))
    }
  }

  async function toggleEstablishmentStatus(establishment: Establishment) {
    try {
      await $fetch(`/api/establishments/${establishment.id}/update`, {
        method: 'PATCH',
        body: {
          isActive: !establishment.isActive,
        },
      })

      toast.success(establishment.isActive ? 'Établissement désactivé' : 'Établissement activé')
      await loadEstablishments()
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error)
      toast.error('Impossible de changer le statut')
    }
  }

  function openDeleteDialog(establishment: Establishment) {
    selectedEstablishment.value = establishment
    deleteDialogOpen.value = true
  }

  async function deleteEstablishment() {
    if (!selectedEstablishment.value) return

    try {
      await $fetch(`/api/establishments/${selectedEstablishment.value.id}/delete`, {
        method: 'DELETE',
      })

      toast.success('Établissement désactivé avec succès')
      deleteDialogOpen.value = false
      await loadEstablishments()
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'établissement:', error)
      toast.error('Impossible de supprimer l\'établissement')
    }
  }

  return {
    loading,
    establishments,
    createDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    newEstablishment,
    editEstablishment,
    selectedEstablishment,
    loadEstablishments,
    openCreateDialog,
    createEstablishment,
    openEditDialog,
    updateEstablishment,
    toggleEstablishmentStatus,
    openDeleteDialog,
    deleteEstablishment,
  }
}
