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
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>

    <!-- Liste des groupes -->
    <div v-else class="space-y-4">
      <Card v-for="group in variationGroups" :key="group.id" class="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-accent rounded-lg">
                <Layers class="w-5 h-5" />
              </div>
                <div>
                  <CardTitle class="text-xl">{{ group.name }}</CardTitle>
                  <CardDescription>{{ group.variations.length }} variation(s)</CardDescription>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Button variant="ghost" size="sm" @click="openAddVariationDialog(group)">
                  <Plus class="w-4 h-4 mr-1" />
                  Ajouter une variation
                </Button>
                <Button variant="ghost" size="sm" @click="openEditGroupDialog(group)">
                  <Edit class="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" @click="openDeleteGroupDialog(group)">
                  <Trash2 class="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <!-- Liste des variations -->
            <div v-if="group.variations.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="variation in group.variations"
                :key="variation.id"
                class="flex items-center gap-2 px-3 py-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
              >
                <span class="font-medium">{{ variation.name }}</span>
                <div class="flex items-center gap-1">
                  <Button variant="ghost" size="icon" class="h-6 w-6" @click="openEditVariationDialog(variation, group)">
                    <Edit class="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" class="h-6 w-6" @click="openDeleteVariationDialog(variation)">
                    <Trash2 class="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-muted-foreground">
              Aucune variation dans ce groupe
            </div>
          </CardContent>
        </Card>

      <div v-if="variationGroups.length === 0" class="text-center py-12">
        <Layers class="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <p class="text-muted-foreground text-lg">Aucun groupe de variation</p>
        <p class="text-muted-foreground text-sm">Créez votre premier groupe pour commencer</p>
      </div>
    </div>

    <!-- Dialog: Créer un groupe -->
    <Dialog v-model:open="createGroupDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau groupe de variation</DialogTitle>
          <DialogDescription>
            Créez un nouveau groupe (ex: Couleur, Taille, Matière)
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="group-name">Nom du groupe</Label>
            <Input
              id="group-name"
              v-model="newGroupName"
              placeholder="Ex: Couleur, Taille, Matière..."
              @keyup.enter="createGroup"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createGroupDialogOpen = false">Annuler</Button>
          <Button @click="createGroup" :disabled="!newGroupName.trim()">Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Modifier un groupe -->
    <Dialog v-model:open="editGroupDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le groupe</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="edit-group-name">Nom du groupe</Label>
            <Input
              id="edit-group-name"
              v-model="editGroupName"
              @keyup.enter="updateGroup"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editGroupDialogOpen = false">Annuler</Button>
          <Button @click="updateGroup" :disabled="!editGroupName.trim()">Modifier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Supprimer un groupe -->
    <Dialog v-model:open="deleteGroupDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer le groupe</DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer ce groupe ? Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteGroupDialogOpen = false">Annuler</Button>
          <Button variant="destructive" @click="deleteGroup">Supprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Ajouter une variation -->
    <Dialog v-model:open="addVariationDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une variation</DialogTitle>
          <DialogDescription>
            Ajouter une valeur au groupe "{{ selectedGroup?.name }}"
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="variation-name">Nom de la variation</Label>
            <Input
              id="variation-name"
              v-model="newVariationName"
              placeholder="Ex: Rouge, Bleu, S, M, L..."
              @keyup.enter="createVariation"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="addVariationDialogOpen = false">Annuler</Button>
          <Button @click="createVariation" :disabled="!newVariationName.trim()">Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Modifier une variation -->
    <Dialog v-model:open="editVariationDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la variation</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="edit-variation-name">Nom de la variation</Label>
            <Input
              id="edit-variation-name"
              v-model="editVariationName"
              @keyup.enter="updateVariation"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editVariationDialogOpen = false">Annuler</Button>
          <Button @click="updateVariation" :disabled="!editVariationName.trim()">Modifier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Supprimer une variation -->
    <Dialog v-model:open="deleteVariationDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer la variation</DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer cette variation ? Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteVariationDialogOpen = false">Annuler</Button>
          <Button variant="destructive" @click="deleteVariation">Supprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus, Edit, Trash2, Layers } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
