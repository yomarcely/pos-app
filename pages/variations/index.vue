<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Gestion des variations</h1>
        <p class="text-muted-foreground mt-1">
          Créez des groupes de variations (Couleur, Taille...) et leurs valeurs
        </p>
      </div>
      <Button @click="openCreateGroupDialog">
        <Plus class="w-4 h-4 mr-2" />
        Nouveau groupe
      </Button>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des variations..." />

    <!-- Liste des groupes -->
    <div v-else class="space-y-4">
      <VariationGroupCard
        v-for="group in variationGroups"
        :key="group.id"
        :group="group"
        @add-variation="openAddVariationDialog"
        @edit-group="openEditGroupDialog"
        @delete-group="openDeleteGroupDialog"
        @edit-variation="openEditVariationDialog"
        @delete-variation="openDeleteVariationDialog"
      />

      <EmptyState
        v-if="variationGroups.length === 0"
        :icon="Layers"
        title="Aucun groupe de variation"
        description="Créez votre premier groupe pour commencer"
      />
    </div>

    <!-- Dialog: Créer un groupe -->
    <FormDialog
      v-model:open="createGroupDialogOpen"
      v-model="newGroupName"
      title="Nouveau groupe de variation"
      description="Créez un nouveau groupe (ex: Couleur, Taille, Matière)"
      label="Nom du groupe"
      placeholder="Ex: Couleur, Taille, Matière..."
      submit-label="Créer"
      @submit="createGroup"
    />

    <!-- Dialog: Modifier un groupe -->
    <FormDialog
      v-model:open="editGroupDialogOpen"
      v-model="editGroupName"
      title="Modifier le groupe"
      label="Nom du groupe"
      submit-label="Modifier"
      @submit="updateGroup"
    />

    <!-- Dialog: Supprimer un groupe -->
    <ConfirmDialog
      v-model:open="deleteGroupDialogOpen"
      title="Supprimer le groupe"
      description="Êtes-vous sûr de vouloir supprimer ce groupe ? Cette action est irréversible."
      confirm-label="Supprimer"
      @confirm="deleteGroup"
    />

    <!-- Dialog: Ajouter une variation -->
    <FormDialog
      v-model:open="addVariationDialogOpen"
      v-model="newVariationName"
      title="Ajouter une variation"
      :description="selectedGroup ? `Ajouter une valeur au groupe &quot;${selectedGroup.name}&quot;` : ''"
      label="Nom de la variation"
      placeholder="Ex: Rouge, Bleu, S, M, L..."
      submit-label="Ajouter"
      @submit="createVariation"
    />

    <!-- Dialog: Modifier une variation -->
    <FormDialog
      v-model:open="editVariationDialogOpen"
      v-model="editVariationName"
      title="Modifier la variation"
      label="Nom de la variation"
      submit-label="Modifier"
      @submit="updateVariation"
    />

    <!-- Dialog: Supprimer une variation -->
    <ConfirmDialog
      v-model:open="deleteVariationDialogOpen"
      title="Supprimer la variation"
      description="Êtes-vous sûr de vouloir supprimer cette variation ? Cette action est irréversible."
      confirm-label="Supprimer"
      @confirm="deleteVariation"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus, Layers } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormDialog from '@/components/ui/FormDialog.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import VariationGroupCard from '@/components/variations/VariationGroupCard.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Variation {
  id: number
  name: string
  sortOrder: number
}

interface VariationGroup {
  id: number
  name: string
  variations: Variation[]
}

// State
const loading = ref(true)
const variationGroups = ref<VariationGroup[]>([])

// Dialog states - Groupes
const createGroupDialogOpen = ref(false)
const editGroupDialogOpen = ref(false)
const deleteGroupDialogOpen = ref(false)
const newGroupName = ref('')
const editGroupName = ref('')
const selectedGroup = ref<VariationGroup | null>(null)

// Dialog states - Variations
const addVariationDialogOpen = ref(false)
const editVariationDialogOpen = ref(false)
const deleteVariationDialogOpen = ref(false)
const newVariationName = ref('')
const editVariationName = ref('')
const selectedVariation = ref<Variation | null>(null)

// Charger les données
async function loadVariations() {
  try {
    loading.value = true
    const response = await $fetch('/api/variations')
    variationGroups.value = response.groups
  } catch (error) {
    console.error('Erreur lors du chargement des variations:', error)
    toast.error('Erreur lors du chargement des variations')
  } finally {
    loading.value = false
  }
}

// Groupes
function openCreateGroupDialog() {
  newGroupName.value = ''
  createGroupDialogOpen.value = true
}

function openEditGroupDialog(group: VariationGroup) {
  selectedGroup.value = group
  editGroupName.value = group.name
  editGroupDialogOpen.value = true
}

function openDeleteGroupDialog(group: VariationGroup) {
  selectedGroup.value = group
  deleteGroupDialogOpen.value = true
}

async function createGroup() {
  if (!newGroupName.value.trim()) return

  try {
    await $fetch('/api/variations/groups/create', {
      method: 'POST',
      body: { name: newGroupName.value },
    })

    toast.success('Groupe de variation créé avec succès')

    createGroupDialogOpen.value = false
    await loadVariations()
  } catch (error) {
    console.error('Erreur lors de la création du groupe:', error)
    toast.error('Impossible de créer le groupe')
  }
}

async function updateGroup() {
  if (!selectedGroup.value || !editGroupName.value.trim()) return

  try {
    await $fetch(`/api/variations/groups/${selectedGroup.value.id}/update`, {
      method: 'PATCH',
      body: { name: editGroupName.value },
    })

    toast.success('Groupe modifié avec succès')

    editGroupDialogOpen.value = false
    await loadVariations()
  } catch (error) {
    console.error('Erreur lors de la modification du groupe:', error)
    toast.error('Impossible de modifier le groupe')
  }
}

async function deleteGroup() {
  if (!selectedGroup.value) return

  try {
    await $fetch(`/api/variations/groups/${selectedGroup.value.id}/delete`, {
      method: 'DELETE',
    })

    toast.success('Groupe supprimé avec succès')

    deleteGroupDialogOpen.value = false
    await loadVariations()
  } catch (error: any) {
    console.error('Erreur lors de la suppression du groupe:', error)
    toast.error(error.data?.message || 'Impossible de supprimer le groupe')
  }
}

// Variations
function openAddVariationDialog(group: VariationGroup) {
  selectedGroup.value = group
  newVariationName.value = ''
  addVariationDialogOpen.value = true
}

function openEditVariationDialog(variation: Variation, group: VariationGroup) {
  selectedVariation.value = variation
  selectedGroup.value = group
  editVariationName.value = variation.name
  editVariationDialogOpen.value = true
}

function openDeleteVariationDialog(variation: Variation) {
  selectedVariation.value = variation
  deleteVariationDialogOpen.value = true
}

async function createVariation() {
  if (!selectedGroup.value || !newVariationName.value.trim()) return

  try {
    await $fetch('/api/variations/create', {
      method: 'POST',
      body: {
        groupId: selectedGroup.value.id,
        name: newVariationName.value,
      },
    })

    toast.success('Variation ajoutée avec succès')

    addVariationDialogOpen.value = false
    await loadVariations()
  } catch (error) {
    console.error('Erreur lors de la création de la variation:', error)
    toast.error('Impossible de créer la variation')
  }
}

async function updateVariation() {
  if (!selectedVariation.value || !editVariationName.value.trim()) return

  try {
    await $fetch(`/api/variations/${selectedVariation.value.id}/update`, {
      method: 'PATCH',
      body: { name: editVariationName.value },
    })

    toast.success('Variation modifiée avec succès')

    editVariationDialogOpen.value = false
    await loadVariations()
  } catch (error) {
    console.error('Erreur lors de la modification de la variation:', error)
    toast.error('Impossible de modifier la variation')
  }
}

async function deleteVariation() {
  if (!selectedVariation.value) return

  try {
    await $fetch(`/api/variations/${selectedVariation.value.id}/delete`, {
      method: 'DELETE',
    })

    toast.success('Variation supprimée avec succès')

    deleteVariationDialogOpen.value = false
    await loadVariations()
  } catch (error) {
    console.error('Erreur lors de la suppression de la variation:', error)
    toast.error('Impossible de supprimer la variation')
  }
}

// Charger au montage
onMounted(() => {
  loadVariations()
})
</script>
