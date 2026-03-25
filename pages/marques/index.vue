<template>
  <div class="p-6 space-y-6">
    <PageHeader
      title="Gestion des marques"
      description="Gérez les marques de vos produits"
    >
      <template #actions>
        <Button @click="openCreateDialog">
          <Plus class="w-4 h-4 mr-2" />
          Nouvelle marque
        </Button>
      </template>
    </PageHeader>

    <!-- Search -->
    <div class="flex items-center gap-4">
      <Input
        v-model="search"
        placeholder="Rechercher une marque..."
        class="max-w-sm"
      />
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des marques..." />

    <!-- Table -->
    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="brand in filteredBrands" :key="brand.id">
            <TableCell class="font-medium">{{ brand.name }}</TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="sm" @click="openEditDialog(brand)">
                <Pencil class="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" @click="openDeleteDialog(brand)">
                <Trash2 class="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <EmptyState
        v-if="!filteredBrands.length && !loading"
        :icon="Tag"
        title="Aucune marque"
        :description="search ? 'Aucune marque ne correspond à votre recherche' : 'Créez votre première marque pour commencer'"
      />
    </div>

    <!-- Dialog: Créer/Modifier -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingBrand ? 'Modifier la marque' : 'Nouvelle marque' }}</DialogTitle>
          <DialogDescription>
            {{ editingBrand ? 'Modifiez le nom de la marque' : 'Créez une nouvelle marque' }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="brand-name">Nom *</Label>
            <Input
              id="brand-name"
              v-model="formName"
              placeholder="Ex: Nike"
              @keyup.enter="saveBrand"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">Annuler</Button>
          <Button @click="saveBrand" :disabled="saving">
            {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Confirmer suppression -->
    <ConfirmDialog
      v-model:open="deleteDialogOpen"
      title="Supprimer la marque"
      :description="`Êtes-vous sûr de vouloir supprimer la marque &quot;${brandToDelete?.name}&quot; ?`"
      confirm-text="Supprimer"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus, Pencil, Trash2, Tag } from 'lucide-vue-next'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PageHeader from '@/components/common/PageHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'
import { useBrands } from '@/composables/useBrands'
import type { Brand } from '@/types'

const toast = useToast()
const { brands, loading, loadBrands, createBrand, updateBrand, deleteBrand } = useBrands()

const search = ref('')
const dialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const editingBrand = ref<Brand | null>(null)
const brandToDelete = ref<Brand | null>(null)
const formName = ref('')
const saving = ref(false)

const filteredBrands = computed(() => {
  if (!search.value) return brands.value
  const q = search.value.toLowerCase()
  return brands.value.filter(b => b.name.toLowerCase().includes(q))
})

function openCreateDialog() {
  editingBrand.value = null
  formName.value = ''
  dialogOpen.value = true
}

function openEditDialog(brand: Brand) {
  editingBrand.value = brand
  formName.value = brand.name
  dialogOpen.value = true
}

function openDeleteDialog(brand: Brand) {
  brandToDelete.value = brand
  deleteDialogOpen.value = true
}

async function saveBrand() {
  if (!formName.value.trim()) {
    toast.error('Le nom de la marque est obligatoire')
    return
  }

  saving.value = true
  try {
    if (editingBrand.value) {
      await updateBrand(editingBrand.value.id, formName.value.trim())
      toast.success('Marque modifiée avec succès')
    } else {
      await createBrand(formName.value.trim())
      toast.success('Marque créée avec succès')
    }
    dialogOpen.value = false
  } catch (error: unknown) {
    toast.error(extractFetchError(error, 'Erreur lors de l\'enregistrement'))
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!brandToDelete.value) return

  try {
    await deleteBrand(brandToDelete.value.id)
    toast.success('Marque supprimée avec succès')
  } catch (error: unknown) {
    toast.error(extractFetchError(error, 'Erreur lors de la suppression'))
  }
}

onMounted(() => {
  loadBrands()
})
</script>
