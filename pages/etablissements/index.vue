<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Gestion des établissements"
      description="Gérez vos différents points de vente et établissements"
    >
      <template #actions>
        <Button variant="outline" @click="goToSync">
          <Network class="w-4 h-4 mr-2" />
          Synchronisation
        </Button>
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
            Ajouter une caisse à l'établissement {{ selectedEstablishmentForRegister?.name }}
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

import { Plus, Building2, Network } from 'lucide-vue-next'
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
import { useEstablishments } from '@/composables/useEstablishments'
import { useRegisters } from '@/composables/useRegisters'

const {
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
} = useEstablishments()

const {
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
} = useRegisters(establishments)

function goToSync() {
  navigateTo('/etablissements/synchronisation')
}

onMounted(async () => {
  await Promise.all([loadEstablishments(), loadRegisters()])
})
</script>
