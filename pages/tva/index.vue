<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Gestion des taux de TVA"
      description="Gérez les taux de TVA pour vos produits (Norme NF525)"
    >
      <template #actions>
        <Button @click="openCreateDialog">
          <Plus class="w-4 h-4 mr-2" />
          Nouveau taux de TVA
        </Button>
      </template>
    </PageHeader>

    <!-- Loading -->
    <LoadingSpinner v-if="pending" text="Chargement des taux de TVA..." />

    <!-- Table -->
    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Code NF525</TableHead>
            <TableHead>Taux</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Par défaut</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="rate in taxRates" :key="rate.id">
            <TableCell class="font-medium">{{ rate.name }}</TableCell>
            <TableCell>
              <Badge variant="secondary">{{ rate.code }}</Badge>
            </TableCell>
            <TableCell>{{ rate.rate }}%</TableCell>
            <TableCell class="text-muted-foreground">{{ rate.description || '-' }}</TableCell>
            <TableCell>
              <Badge v-if="rate.isDefault" variant="default">Oui</Badge>
              <span v-else class="text-muted-foreground">-</span>
            </TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="sm" @click="openEditDialog(rate)">
                <Pencil class="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" @click="openDeleteDialog(rate)">
                <Trash2 class="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Empty state -->
      <EmptyState
        v-if="!taxRates?.length"
        :icon="Calculator"
        title="Aucun taux de TVA"
        description="Créez votre premier taux de TVA pour commencer"
      />
    </div>

    <!-- Dialog: Créer/Modifier un taux de TVA -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingRate ? 'Modifier le taux de TVA' : 'Nouveau taux de TVA' }}</DialogTitle>
          <DialogDescription>
            {{ editingRate ? 'Modifiez les informations du taux de TVA' : 'Créez un nouveau taux de TVA' }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="name">Nom *</Label>
            <Input
              id="name"
              v-model="form.name"
              placeholder="Ex: TVA 20%"
            />
          </div>
          <div class="space-y-2">
            <Label for="code">Code NF525 *</Label>
            <Input
              id="code"
              v-model="form.code"
              placeholder="Ex: T1"
              maxlength="10"
            />
            <p class="text-xs text-muted-foreground">Lettres majuscules et chiffres uniquement</p>
          </div>
          <div class="space-y-2">
            <Label for="rate">Taux (%) *</Label>
            <Input
              id="rate"
              v-model="form.rate"
              type="number"
              step="0.01"
              placeholder="Ex: 20"
            />
          </div>
          <div class="space-y-2">
            <Label for="description">Description</Label>
            <Textarea
              id="description"
              v-model="form.description"
              placeholder="Description optionnelle..."
              rows="2"
            />
          </div>
          <div class="flex items-center space-x-2">
            <Switch id="is-default" v-model:checked="form.isDefault" />
            <Label for="is-default">Définir comme taux par défaut</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">
            Annuler
          </Button>
          <Button @click="saveTaxRate" :disabled="saving">
            {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Confirmer la suppression -->
    <ConfirmDialog
      v-model:open="deleteDialogOpen"
      title="Archiver le taux de TVA"
      :description="`Êtes-vous sûr de vouloir archiver le taux &quot;${rateToDelete?.name}&quot; ?`"
      confirm-text="Archiver"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { Plus, Pencil, Trash2, Calculator } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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

const toast = useToast()

interface TaxRate {
  id: number
  name: string
  code: string
  rate: string
  description: string | null
  isDefault: boolean
}

const dialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const editingRate = ref<TaxRate | null>(null)
const rateToDelete = ref<TaxRate | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  code: '',
  rate: '',
  description: '',
  isDefault: false,
})

// Récupérer les taux de TVA
const { data: taxRates, pending, refresh } = await useFetch<TaxRate[]>('/api/tax-rates')

function openCreateDialog() {
  editingRate.value = null
  form.name = ''
  form.code = ''
  form.rate = ''
  form.description = ''
  form.isDefault = false
  dialogOpen.value = true
}

function openEditDialog(rate: TaxRate) {
  editingRate.value = rate
  form.name = rate.name
  form.code = rate.code
  form.rate = rate.rate
  form.description = rate.description || ''
  form.isDefault = rate.isDefault
  dialogOpen.value = true
}

function openDeleteDialog(rate: TaxRate) {
  rateToDelete.value = rate
  deleteDialogOpen.value = true
}

async function saveTaxRate() {
  // Validation basique
  if (!form.name || !form.code || !form.rate) {
    toast.error('Veuillez remplir tous les champs obligatoires')
    return
  }

  // Valider le format du code (lettres majuscules et chiffres uniquement)
  if (!/^[A-Z0-9]+$/.test(form.code)) {
    toast.error('Le code doit contenir uniquement des lettres majuscules et des chiffres')
    return
  }

  saving.value = true
  try {
    if (editingRate.value) {
      // Mise à jour
      await $fetch(`/api/tax-rates/${editingRate.value.id}/update`, {
        method: 'PATCH',
        body: form,
      })
      toast.success('Taux de TVA modifié avec succès')
    } else {
      // Création
      await $fetch('/api/tax-rates/create', {
        method: 'POST',
        body: form,
      })
      toast.success('Taux de TVA créé avec succès')
    }

    await refresh()
    dialogOpen.value = false
  } catch (error: any) {
    console.error('Erreur lors de l\'enregistrement:', error)
    toast.error(error?.data?.message || 'Une erreur est survenue')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!rateToDelete.value) return

  try {
    await $fetch(`/api/tax-rates/${rateToDelete.value.id}/delete`, {
      method: 'DELETE',
    })
    toast.success('Taux de TVA archivé avec succès')
    await refresh()
  } catch (error: any) {
    console.error('Erreur lors de l\'archivage:', error)
    toast.error(error?.data?.message || 'Une erreur est survenue')
  }
}
</script>
