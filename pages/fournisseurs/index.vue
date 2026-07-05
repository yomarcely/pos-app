<template>
  <div class="p-6 space-y-6">
    <PageHeader
      title="Gestion des fournisseurs"
      description="Gérez vos fournisseurs"
    >
      <template #actions>
        <Button @click="openCreateDialog">
          <Plus class="w-4 h-4 mr-2" />
          Nouveau fournisseur
        </Button>
      </template>
    </PageHeader>

    <!-- Search -->
    <div class="flex items-center gap-4">
      <Input
        v-model="search"
        placeholder="Rechercher un fournisseur..."
        class="max-w-sm"
      />
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des fournisseurs..." />

    <!-- Table -->
    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="supplier in filteredSuppliers" :key="supplier.id">
            <TableCell class="font-medium">{{ supplier.name }}</TableCell>
            <TableCell class="text-muted-foreground">{{ supplier.email || '-' }}</TableCell>
            <TableCell class="text-muted-foreground">{{ supplier.phone || '-' }}</TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="sm" @click="openEditDialog(supplier)">
                <Pencil class="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" @click="openDeleteDialog(supplier)">
                <Trash2 class="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <EmptyState
        v-if="!filteredSuppliers.length && !loading"
        :icon="Truck"
        title="Aucun fournisseur"
        :description="search ? 'Aucun fournisseur ne correspond à votre recherche' : 'Créez votre premier fournisseur pour commencer'"
      />
    </div>

    <!-- Dialog: Créer/Modifier -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur' }}</DialogTitle>
          <DialogDescription>
            {{ editingSupplier ? 'Modifiez les informations du fournisseur' : 'Créez un nouveau fournisseur' }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="supplier-name">Nom *</Label>
            <Input
              id="supplier-name"
              v-model="form.name"
              placeholder="Ex: Adidas"
              @keydown.enter="saveSupplier"
            />
          </div>
          <div class="space-y-2">
            <Label for="supplier-email">Email</Label>
            <Input
              id="supplier-email"
              v-model="form.email"
              type="email"
              placeholder="contact@fournisseur.com"
              @keydown.enter="saveSupplier"
            />
          </div>
          <div class="space-y-2">
            <Label for="supplier-phone">Téléphone</Label>
            <Input
              id="supplier-phone"
              v-model="form.phone"
              placeholder="01 23 45 67 89"
              @keydown.enter="saveSupplier"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">Annuler</Button>
          <Button @click="saveSupplier" :disabled="saving">
            {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Confirmer suppression -->
    <ConfirmDialog
      v-model:open="deleteDialogOpen"
      title="Supprimer le fournisseur"
      :description="`Êtes-vous sûr de vouloir supprimer le fournisseur &quot;${supplierToDelete?.name}&quot; ?`"
      confirm-label="Supprimer"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus, Pencil, Trash2, Truck } from 'lucide-vue-next'
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
import { useSuppliers } from '@/composables/useSuppliers'
import type { Supplier } from '@/types'

const toast = useToast()
const { suppliers, loading, loadSuppliers, createSupplier, updateSupplier, deleteSupplier } = useSuppliers()

const search = ref('')
const dialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const editingSupplier = ref<Supplier | null>(null)
const supplierToDelete = ref<Supplier | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  email: '',
  phone: '',
})

const filteredSuppliers = computed(() => {
  if (!search.value) return suppliers.value
  const q = search.value.toLowerCase()
  return suppliers.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.email?.toLowerCase().includes(q) ||
    s.phone?.includes(q)
  )
})

function openCreateDialog() {
  editingSupplier.value = null
  form.name = ''
  form.email = ''
  form.phone = ''
  dialogOpen.value = true
}

function openEditDialog(supplier: Supplier) {
  editingSupplier.value = supplier
  form.name = supplier.name
  form.email = supplier.email || ''
  form.phone = supplier.phone || ''
  dialogOpen.value = true
}

function openDeleteDialog(supplier: Supplier) {
  supplierToDelete.value = supplier
  deleteDialogOpen.value = true
}

async function saveSupplier() {
  if (!form.name.trim()) {
    toast.error('Le nom du fournisseur est obligatoire')
    return
  }

  saving.value = true
  try {
    const data = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    }

    if (editingSupplier.value) {
      await updateSupplier(editingSupplier.value.id, data)
      toast.success('Fournisseur modifié avec succès')
    } else {
      await createSupplier(data)
      toast.success('Fournisseur créé avec succès')
    }
    dialogOpen.value = false
  } catch (error: unknown) {
    toast.error(extractFetchError(error, 'Erreur lors de l\'enregistrement'))
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!supplierToDelete.value) return

  try {
    await deleteSupplier(supplierToDelete.value.id)
    toast.success('Fournisseur supprimé avec succès')
  } catch (error: unknown) {
    toast.error(extractFetchError(error, 'Erreur lors de la suppression'))
  } finally {
    // Fermer le dialog de confirmation dans tous les cas (le toast porte l'issue)
    deleteDialogOpen.value = false
    supplierToDelete.value = null
  }
}

onMounted(() => {
  loadSuppliers()
})
</script>
