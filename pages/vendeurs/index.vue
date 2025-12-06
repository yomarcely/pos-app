<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Gestion des vendeurs"
      description="Gérez les vendeurs de votre point de vente"
    >
      <template #actions>
        <Button @click="openCreateDialog">
          <Plus class="w-4 h-4 mr-2" />
          Nouveau vendeur
        </Button>
      </template>
    </PageHeader>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des vendeurs..." />

    <!-- Liste des vendeurs -->
    <div v-else class="space-y-4">
      <SellerCard
        v-for="seller in sellers"
        :key="seller.id"
        :seller="seller"
        @edit="openEditDialog"
        @delete="openDeleteDialog"
        @toggle-status="toggleSellerStatus"
      />

      <EmptyState
        v-if="sellers.length === 0"
        :icon="Users"
        title="Aucun vendeur"
        description="Créez votre premier vendeur pour commencer"
      />
    </div>

    <!-- Dialog: Créer un vendeur -->
    <Dialog v-model:open="createDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau vendeur</DialogTitle>
          <DialogDescription>Créez un nouveau vendeur</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="create-name">Nom du vendeur *</Label>
            <Input
              id="create-name"
              v-model="newSeller.name"
              placeholder="Ex: Jean Dupont"
            />
          </div>
          <div class="space-y-2">
            <Label for="create-code">Code vendeur (optionnel)</Label>
            <Input
              id="create-code"
              v-model="newSeller.code"
              placeholder="Ex: JD01"
              maxlength="20"
            />
          </div>
          <div class="flex items-center space-x-2">
            <Switch id="create-active" v-model="newSeller.isActive" />
            <Label for="create-active">Vendeur actif</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createDialogOpen = false">
            Annuler
          </Button>
          <Button @click="createSeller">
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Modifier un vendeur -->
    <Dialog v-model:open="editDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le vendeur</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="edit-name">Nom du vendeur *</Label>
            <Input
              id="edit-name"
              v-model="editSeller.name"
              placeholder="Ex: Jean Dupont"
            />
          </div>
          <div class="space-y-2">
            <Label for="edit-code">Code vendeur (optionnel)</Label>
            <Input
              id="edit-code"
              v-model="editSeller.code"
              placeholder="Ex: JD01"
              maxlength="20"
            />
          </div>
          <div class="flex items-center space-x-2">
            <Switch id="edit-active" v-model="editSeller.isActive" />
            <Label for="edit-active">Vendeur actif</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editDialogOpen = false">
            Annuler
          </Button>
          <Button @click="updateSeller">
            Modifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Supprimer un vendeur -->
    <ConfirmDialog
      v-model:open="deleteDialogOpen"
      title="Désactiver le vendeur"
      description="Êtes-vous sûr de vouloir désactiver ce vendeur ? Il ne sera plus disponible dans la caisse."
      confirm-label="Désactiver"
      @confirm="deleteSeller"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus, Users } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import SellerCard from '@/components/sellers/SellerCard.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Seller {
  id: number
  name: string
  code: string | null
  isActive: boolean
}

type ApiSeller = Omit<Seller, 'isActive'> & { isActive: boolean | null }

// State
const loading = ref(true)
const sellers = ref<Seller[]>([])

// Dialog states
const createDialogOpen = ref(false)
const editDialogOpen = ref(false)
const deleteDialogOpen = ref(false)

const newSeller = ref({
  name: '',
  code: '',
  isActive: true,
})

const editSeller = ref({
  id: 0,
  name: '',
  code: '',
  isActive: true,
})

const selectedSeller = ref<Seller | null>(null)

// Charger les données
async function loadSellers() {
  try {
    loading.value = true
    const response = await $fetch<{ sellers: ApiSeller[] }>('/api/sellers')
    sellers.value = response.sellers.map(
      (seller): Seller => ({
        ...seller,
        isActive: seller.isActive ?? true,
      })
    )
  } catch (error) {
    console.error('Erreur lors du chargement des vendeurs:', error)
    toast.error('Erreur lors du chargement des vendeurs')
  } finally {
    loading.value = false
  }
}

// Créer
function openCreateDialog() {
  newSeller.value = {
    name: '',
    code: '',
    isActive: true,
  }
  createDialogOpen.value = true
}

async function createSeller() {
  if (!newSeller.value.name.trim()) {
    toast.error('Le nom du vendeur est obligatoire')
    return
  }

  try {
    await $fetch('/api/sellers/create', {
      method: 'POST',
      body: {
        name: newSeller.value.name,
        code: newSeller.value.code || null,
        isActive: newSeller.value.isActive,
      },
    })

    toast.success('Vendeur créé avec succès')
    createDialogOpen.value = false
    await loadSellers()
  } catch (error) {
    console.error('Erreur lors de la création du vendeur:', error)
    toast.error('Impossible de créer le vendeur')
  }
}

// Modifier
function openEditDialog(seller: Seller) {
  editSeller.value = {
    id: seller.id,
    name: seller.name,
    code: seller.code || '',
    isActive: seller.isActive,
  }
  editDialogOpen.value = true
}

async function updateSeller() {
  if (!editSeller.value.name.trim()) {
    toast.error('Le nom du vendeur est obligatoire')
    return
  }

  try {
    await $fetch(`/api/sellers/${editSeller.value.id}/update`, {
      method: 'PATCH',
      body: {
        name: editSeller.value.name,
        code: editSeller.value.code || null,
        isActive: editSeller.value.isActive,
      },
    })

    toast.success('Vendeur modifié avec succès')
    editDialogOpen.value = false
    await loadSellers()
  } catch (error) {
    console.error('Erreur lors de la modification du vendeur:', error)
    toast.error('Impossible de modifier le vendeur')
  }
}

// Changer le statut actif/inactif
async function toggleSellerStatus(seller: Seller) {
  try {
    await $fetch(`/api/sellers/${seller.id}/update`, {
      method: 'PATCH',
      body: {
        isActive: !seller.isActive,
      },
    })

    toast.success(seller.isActive ? 'Vendeur désactivé' : 'Vendeur activé')
    await loadSellers()
  } catch (error) {
    console.error('Erreur lors du changement de statut:', error)
    toast.error('Impossible de changer le statut')
  }
}

// Supprimer (désactiver)
function openDeleteDialog(seller: Seller) {
  selectedSeller.value = seller
  deleteDialogOpen.value = true
}

async function deleteSeller() {
  if (!selectedSeller.value) return

  try {
    await $fetch(`/api/sellers/${selectedSeller.value.id}/delete`, {
      method: 'DELETE',
    })

    toast.success('Vendeur désactivé avec succès')
    deleteDialogOpen.value = false
    await loadSellers()
  } catch (error) {
    console.error('Erreur lors de la suppression du vendeur:', error)
    toast.error('Impossible de supprimer le vendeur')
  }
}

// Charger au montage
onMounted(() => {
  loadSellers()
})
</script>
