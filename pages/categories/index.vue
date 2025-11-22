<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Folder,
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import CategoryTreeItem from '@/components/categories/CategoryTreeItem.vue'

const toast = useToast()

interface Category {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
  icon: string | null
  color: string | null
  isArchived: boolean
  children?: Category[]
}

// État
const categories = ref<Category[]>([])
const loading = ref(false)
const expandedCategories = ref<Set<number>>(new Set())

// Dialogs
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)

// Formulaire
const formData = ref({
  name: '',
  parentId: null as number | null,
  sortOrder: 0,
  icon: '',
  color: '#3b82f6',
})

const selectedCategory = ref<Category | null>(null)
const parentCategory = ref<Category | null>(null)

// Charger les catégories
async function loadCategories() {
  loading.value = true
  try {
    const response = await $fetch('/api/categories')
    if (response.success) {
      categories.value = response.categories
    }
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error)
    toast.error('Erreur lors du chargement des catégories')
  } finally {
    loading.value = false
  }
}

// Toggle expand/collapse
function toggleExpand(categoryId: number) {
  if (expandedCategories.value.has(categoryId)) {
    expandedCategories.value.delete(categoryId)
  } else {
    expandedCategories.value.add(categoryId)
  }
}

// Ouvrir dialog de création
function openCreateDialog(parent: Category | null = null) {
  parentCategory.value = parent
  formData.value = {
    name: '',
    parentId: parent?.id || null,
    sortOrder: 0,
    icon: '',
    color: '#3b82f6',
  }
  showCreateDialog.value = true
}

// Ouvrir dialog d'édition
function openEditDialog(category: Category) {
  selectedCategory.value = category
  formData.value = {
    name: category.name,
    parentId: category.parentId,
    sortOrder: category.sortOrder,
    icon: category.icon || '',
    color: category.color || '#3b82f6',
  }
  showEditDialog.value = true
}

// Ouvrir dialog de suppression
function openDeleteDialog(category: Category) {
  selectedCategory.value = category
  showDeleteDialog.value = true
}

// Créer une catégorie
async function createCategory() {
  if (!formData.value.name.trim()) {
    toast.error('Le nom de la catégorie est obligatoire')
    return
  }

  try {
    const response = await $fetch('/api/categories/create', {
      method: 'POST',
      body: formData.value,
    })

    if (response.success) {
      toast.success('Catégorie créée avec succès')
      showCreateDialog.value = false
      await loadCategories()
    }
  } catch (error) {
    console.error('Erreur lors de la création:', error)
    toast.error('Erreur lors de la création de la catégorie')
  }
}

// Mettre à jour une catégorie
async function updateCategory() {
  if (!selectedCategory.value || !formData.value.name.trim()) {
    toast.error('Le nom de la catégorie est obligatoire')
    return
  }

  try {
    const response = await $fetch(`/api/categories/${selectedCategory.value.id}/update`, {
      method: 'PATCH',
      body: formData.value,
    })

    if (response.success) {
      toast.success('Catégorie mise à jour avec succès')
      showEditDialog.value = false
      await loadCategories()
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error)
    toast.error('Erreur lors de la mise à jour de la catégorie')
  }
}

// Supprimer une catégorie
async function deleteCategory() {
  if (!selectedCategory.value) return

  try {
    const response = await $fetch(`/api/categories/${selectedCategory.value.id}/delete`, {
      method: 'DELETE',
    })

    if (response.success) {
      toast.success('Catégorie supprimée avec succès')
      showDeleteDialog.value = false
      await loadCategories()
    }
  } catch (error: any) {
    console.error('Erreur lors de la suppression:', error)
    toast.error(error.data?.message || 'Erreur lors de la suppression de la catégorie')
  }
}

onMounted(() => {
  loadCategories()
})
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Gestion des catégories</h1>
        <p class="text-muted-foreground mt-1">
          Organisez vos produits en catégories et sous-catégories
        </p>
      </div>
      <Button @click="openCreateDialog(null)">
        <Plus class="w-4 h-4 mr-2" />
        Nouvelle catégorie
      </Button>
    </div>

    <!-- Vue arborescente -->
    <div class="border rounded-lg bg-card">
      <div v-if="loading" class="p-8 text-center text-muted-foreground">
        Chargement des catégories...
      </div>

      <div v-else-if="categories.length === 0" class="p-8 text-center">
        <Folder class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p class="text-lg font-medium">Aucune catégorie</p>
        <p class="text-sm text-muted-foreground mb-4">
          Créez votre première catégorie pour commencer
        </p>
        <Button @click="openCreateDialog(null)">
          <Plus class="w-4 h-4 mr-2" />
          Créer une catégorie
        </Button>
      </div>

      <div v-else class="divide-y">
        <CategoryTreeItem
          v-for="category in categories"
          :key="category.id"
          :category="category"
          :level="0"
          :expanded="expandedCategories.has(category.id)"
          :expanded-categories="expandedCategories"
          @toggle="toggleExpand"
          @edit="openEditDialog"
          @delete="openDeleteDialog"
          @add-subcategory="openCreateDialog"
        />
      </div>
    </div>

    <!-- Dialog de création -->
    <Dialog v-model:open="showCreateDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {{ parentCategory ? `Nouvelle sous-catégorie de "${parentCategory.name}"` : 'Nouvelle catégorie' }}
          </DialogTitle>
          <DialogDescription>
            Créez une nouvelle catégorie {{ parentCategory ? 'enfant' : 'racine' }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div>
            <Label for="name">Nom *</Label>
            <Input id="name" v-model="formData.name" placeholder="Ex: Vêtements" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <Label for="color">Couleur</Label>
              <Input id="color" v-model="formData.color" type="color" />
            </div>
            <div>
              <Label for="sortOrder">Ordre</Label>
              <Input id="sortOrder" v-model.number="formData.sortOrder" type="number" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showCreateDialog = false">Annuler</Button>
          <Button @click="createCategory">Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog d'édition -->
    <Dialog v-model:open="showEditDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la catégorie</DialogTitle>
          <DialogDescription>
            Modifier les informations de la catégorie
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div>
            <Label for="edit-name">Nom *</Label>
            <Input id="edit-name" v-model="formData.name" placeholder="Ex: Vêtements" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <Label for="edit-color">Couleur</Label>
              <Input id="edit-color" v-model="formData.color" type="color" />
            </div>
            <div>
              <Label for="edit-sortOrder">Ordre</Label>
              <Input id="edit-sortOrder" v-model.number="formData.sortOrder" type="number" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showEditDialog = false">Annuler</Button>
          <Button @click="updateCategory">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog de suppression -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer la catégorie</DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer la catégorie "{{ selectedCategory?.name }}" ?
            Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Annuler</Button>
          <Button variant="destructive" @click="deleteCategory">Supprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
