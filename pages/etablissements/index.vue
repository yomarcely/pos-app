<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Gestion des établissements"
      description="Gérez vos différents points de vente et établissements"
    >
      <template #actions>
        <Button @click="openCreateDialog">
          <Plus class="w-4 h-4 mr-2" />
          Nouvel établissement
        </Button>
      </template>
    </PageHeader>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des établissements..." />

    <!-- Liste des établissements -->
    <div v-else class="space-y-4">
      <EstablishmentCard
        v-for="establishment in establishments"
        :key="establishment.id"
        :establishment="establishment"
        :registers="getRegistersByEstablishment(establishment.id)"
        @edit="openEditDialog"
        @delete="openDeleteDialog"
        @toggle-status="toggleEstablishmentStatus"
        @add-register="openAddRegisterDialog"
        @edit-register="openEditRegisterDialog"
        @delete-register="openDeleteRegisterDialog"
        @toggle-register="toggleRegisterStatus"
      />

      <EmptyState
        v-if="establishments.length === 0"
        :icon="Building2"
        title="Aucun établissement"
        description="Créez votre premier établissement pour commencer"
      />
    </div>

    <!-- Dialog: Créer un établissement -->
    <Dialog v-model:open="createDialogOpen">
      <DialogContent class="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel établissement</DialogTitle>
          <DialogDescription>Créez un nouveau point de vente</DialogDescription>
        </DialogHeader>

        <div class="space-y-6 py-4">
          <!-- Informations de base -->
          <div class="space-y-4">
            <h3 class="font-semibold">Informations générales</h3>
            <div class="space-y-2">
              <Label for="create-name">Nom de l'établissement *</Label>
              <Input
                id="create-name"
                v-model="newEstablishment.name"
                placeholder="Ex: Boutique Paris Centre"
              />
            </div>
          </div>

          <!-- Adresse -->
          <div class="space-y-4">
            <h3 class="font-semibold">Adresse</h3>
            <div class="space-y-2">
              <Label for="create-address">Adresse</Label>
              <Textarea
                id="create-address"
                v-model="newEstablishment.address"
                placeholder="Ex: 123 rue de la Paix"
                rows="2"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label for="create-postal-code">Code postal</Label>
                <Input
                  id="create-postal-code"
                  v-model="newEstablishment.postalCode"
                  placeholder="Ex: 75001"
                  maxlength="10"
                />
              </div>
              <div class="space-y-2">
                <Label for="create-city">Ville</Label>
                <Input
                  id="create-city"
                  v-model="newEstablishment.city"
                  placeholder="Ex: Paris"
                />
              </div>
            </div>
            <div class="space-y-2">
              <Label for="create-country">Pays</Label>
              <Input
                id="create-country"
                v-model="newEstablishment.country"
                placeholder="Ex: France"
              />
            </div>
          </div>

          <!-- Contact -->
          <div class="space-y-4">
            <h3 class="font-semibold">Contact</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label for="create-phone">Téléphone</Label>
                <Input
                  id="create-phone"
                  v-model="newEstablishment.phone"
                  placeholder="Ex: 01 23 45 67 89"
                  maxlength="20"
                />
              </div>
              <div class="space-y-2">
                <Label for="create-email">Email</Label>
                <Input
                  id="create-email"
                  v-model="newEstablishment.email"
                  type="email"
                  placeholder="Ex: contact@boutique.fr"
                />
              </div>
            </div>
          </div>

          <!-- Informations légales -->
          <div class="space-y-4">
            <h3 class="font-semibold">Informations légales</h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="space-y-2">
                <Label for="create-siret">SIRET</Label>
                <Input
                  id="create-siret"
                  v-model="newEstablishment.siret"
                  placeholder="14 chiffres"
                  maxlength="14"
                />
              </div>
              <div class="space-y-2">
                <Label for="create-naf">Code NAF</Label>
                <Input
                  id="create-naf"
                  v-model="newEstablishment.naf"
                  placeholder="Ex: 4778C"
                  maxlength="5"
                />
              </div>
              <div class="space-y-2">
                <Label for="create-tva">N° TVA</Label>
                <Input
                  id="create-tva"
                  v-model="newEstablishment.tvaNumber"
                  placeholder="Ex: FR12345678901"
                  maxlength="20"
                />
              </div>
            </div>
          </div>

          <!-- Statut -->
          <div class="flex items-center space-x-2">
            <Switch id="create-active" v-model="newEstablishment.isActive" />
            <Label for="create-active">Établissement actif</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="createDialogOpen = false">
            Annuler
          </Button>
          <Button @click="createEstablishment">
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Modifier un établissement -->
    <Dialog v-model:open="editDialogOpen">
      <DialogContent class="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'établissement</DialogTitle>
        </DialogHeader>

        <div class="space-y-6 py-4">
          <!-- Informations de base -->
          <div class="space-y-4">
            <h3 class="font-semibold">Informations générales</h3>
            <div class="space-y-2">
              <Label for="edit-name">Nom de l'établissement *</Label>
              <Input
                id="edit-name"
                v-model="editEstablishment.name"
                placeholder="Ex: Boutique Paris Centre"
              />
            </div>
          </div>

          <!-- Adresse -->
          <div class="space-y-4">
            <h3 class="font-semibold">Adresse</h3>
            <div class="space-y-2">
              <Label for="edit-address">Adresse</Label>
              <Textarea
                id="edit-address"
                v-model="editEstablishment.address"
                placeholder="Ex: 123 rue de la Paix"
                rows="2"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label for="edit-postal-code">Code postal</Label>
                <Input
                  id="edit-postal-code"
                  v-model="editEstablishment.postalCode"
                  placeholder="Ex: 75001"
                  maxlength="10"
                />
              </div>
              <div class="space-y-2">
                <Label for="edit-city">Ville</Label>
                <Input
                  id="edit-city"
                  v-model="editEstablishment.city"
                  placeholder="Ex: Paris"
                />
              </div>
            </div>
            <div class="space-y-2">
              <Label for="edit-country">Pays</Label>
              <Input
                id="edit-country"
                v-model="editEstablishment.country"
                placeholder="Ex: France"
              />
            </div>
          </div>

          <!-- Contact -->
          <div class="space-y-4">
            <h3 class="font-semibold">Contact</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label for="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  v-model="editEstablishment.phone"
                  placeholder="Ex: 01 23 45 67 89"
                  maxlength="20"
                />
              </div>
              <div class="space-y-2">
                <Label for="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  v-model="editEstablishment.email"
                  type="email"
                  placeholder="Ex: contact@boutique.fr"
                />
              </div>
            </div>
          </div>

          <!-- Informations légales -->
          <div class="space-y-4">
            <h3 class="font-semibold">Informations légales</h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="space-y-2">
                <Label for="edit-siret">SIRET</Label>
                <Input
                  id="edit-siret"
                  v-model="editEstablishment.siret"
                  placeholder="14 chiffres"
                  maxlength="14"
                />
              </div>
              <div class="space-y-2">
                <Label for="edit-naf">Code NAF</Label>
                <Input
                  id="edit-naf"
                  v-model="editEstablishment.naf"
                  placeholder="Ex: 4778C"
                  maxlength="5"
                />
              </div>
              <div class="space-y-2">
                <Label for="edit-tva">N° TVA</Label>
                <Input
                  id="edit-tva"
                  v-model="editEstablishment.tvaNumber"
                  placeholder="Ex: FR12345678901"
                  maxlength="20"
                />
              </div>
            </div>
          </div>

          <!-- Statut -->
          <div class="flex items-center space-x-2">
            <Switch id="edit-active" v-model="editEstablishment.isActive" />
            <Label for="edit-active">Établissement actif</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="editDialogOpen = false">
            Annuler
          </Button>
          <Button @click="updateEstablishment">
            Modifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Supprimer un établissement -->
    <ConfirmDialog
      v-model:open="deleteDialogOpen"
      title="Désactiver l'établissement"
      description="Êtes-vous sûr de vouloir désactiver cet établissement ? Il ne sera plus disponible."
      confirm-label="Désactiver"
      @confirm="deleteEstablishment"
    />

    <!-- Dialog: Ajouter une caisse -->
    <Dialog v-model:open="addRegisterDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle caisse</DialogTitle>
          <DialogDescription>
            Ajouter une caisse à l'établissement {{ selectedEstablishment?.name }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="register-name">Nom de la caisse *</Label>
            <Input
              id="register-name"
              v-model="newRegister.name"
              placeholder="Ex: Caisse 1, Caisse principale"
            />
          </div>
          <div class="flex items-center space-x-2">
            <Switch id="register-active" v-model="newRegister.isActive" />
            <Label for="register-active">Caisse active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="addRegisterDialogOpen = false">
            Annuler
          </Button>
          <Button @click="createRegister">
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Modifier une caisse -->
    <Dialog v-model:open="editRegisterDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la caisse</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="edit-register-name">Nom de la caisse *</Label>
            <Input
              id="edit-register-name"
              v-model="editRegister.name"
              placeholder="Ex: Caisse 1"
            />
          </div>
          <div class="flex items-center space-x-2">
            <Switch id="edit-register-active" v-model="editRegister.isActive" />
            <Label for="edit-register-active">Caisse active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editRegisterDialogOpen = false">
            Annuler
          </Button>
          <Button @click="updateRegister">
            Modifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Supprimer une caisse -->
    <ConfirmDialog
      v-model:open="deleteRegisterDialogOpen"
      title="Désactiver la caisse"
      description="Êtes-vous sûr de vouloir désactiver cette caisse ?"
      confirm-label="Désactiver"
      @confirm="deleteRegister"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus, Building2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PageHeader from '@/components/common/PageHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EstablishmentCard from '@/components/establishments/EstablishmentCard.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Establishment {
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

interface Register {
  id: number
  establishmentId: number
  name: string
  isActive: boolean
}

type ApiRegister = Omit<Register, 'isActive'> & { isActive: boolean | null }

// State
const loading = ref(true)
const establishments = ref<Establishment[]>([])
const registers = ref<Register[]>([])

// Dialog states
const createDialogOpen = ref(false)
const editDialogOpen = ref(false)
const deleteDialogOpen = ref(false)

// Dialog states - Registers
const addRegisterDialogOpen = ref(false)
const editRegisterDialogOpen = ref(false)
const deleteRegisterDialogOpen = ref(false)

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

// Charger les données
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

// Créer
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
  } catch (error: any) {
    console.error('Erreur lors de la création de l\'établissement:', error)
    toast.error(error.data?.message || 'Impossible de créer l\'établissement')
  }
}

// Modifier
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
  } catch (error: any) {
    console.error('Erreur lors de la modification de l\'établissement:', error)
    toast.error(error.data?.message || 'Impossible de modifier l\'établissement')
  }
}

// Changer le statut actif/inactif
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

// Supprimer (désactiver)
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

// ========================================
// GESTION DES CAISSES
// ========================================

function openAddRegisterDialog(establishment: Establishment) {
  selectedEstablishment.value = establishment
  newRegister.value = {
    name: '',
    isActive: true,
  }
  addRegisterDialogOpen.value = true
}

async function createRegister() {
  if (!selectedEstablishment.value || !newRegister.value.name.trim()) {
    toast.error('Le nom de la caisse est obligatoire')
    return
  }

  try {
    await $fetch('/api/registers/create', {
      method: 'POST',
      body: {
        establishmentId: selectedEstablishment.value.id,
        name: newRegister.value.name,
        isActive: newRegister.value.isActive,
      },
    })

    toast.success('Caisse créée avec succès')
    addRegisterDialogOpen.value = false
    await loadRegisters()
  } catch (error: any) {
    console.error('Erreur lors de la création de la caisse:', error)
    toast.error(error.data?.message || 'Impossible de créer la caisse')
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
  } catch (error: any) {
    console.error('Erreur lors de la modification de la caisse:', error)
    toast.error(error.data?.message || 'Impossible de modifier la caisse')
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

// Charger au montage
onMounted(async () => {
  await Promise.all([
    loadEstablishments(),
    loadRegisters(),
  ])
})
</script>
