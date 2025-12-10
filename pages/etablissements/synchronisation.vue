<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Synchronisation Multi-Établissements"
      description="Gérez les groupes de synchronisation et les règles de partage des données"
    >
      <template #actions>
        <Button variant="outline" @click="$router.back()">
          <ArrowLeft class="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button @click="openCreateGroupDialog">
          <Plus class="w-4 h-4 mr-2" />
          Nouveau groupe
        </Button>
      </template>
    </PageHeader>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des groupes de synchronisation..." />

    <!-- Liste des groupes -->
    <div v-else class="space-y-6">
      <!-- Carte d'information -->
      <div
        v-if="syncGroups.length === 0"
        class="rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-5 shadow-sm"
      >
        <div class="flex items-start gap-3">
          <Info class="w-5 h-5 text-blue-600 mt-0.5" />
          <div class="flex-1 space-y-1">
            <h3 class="font-semibold text-blue-900">À quoi sert la synchronisation ?</h3>
            <p class="text-sm text-blue-700">
              Les groupes de synchronisation permettent de partager automatiquement les produits et clients entre plusieurs établissements,
              tout en conservant un stock indépendant. Choisissez les champs à synchroniser (nom, prix, etc.).
            </p>
          </div>
        </div>
      </div>

      <!-- Groupes existants -->
      <div class="grid gap-4">
        <div
          v-for="group in syncGroups"
          :key="group.id"
          class="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white shadow-[0_10px_35px_-18px_rgba(15,23,42,0.35)]"
        >
          <div class="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-primary/80 via-primary to-primary/60" />
          <div class="p-6 md:p-7">
            <!-- Header du groupe -->
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-3">
                  <h3 class="text-lg font-semibold text-slate-900">{{ group.name }}</h3>
                  <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Building2 class="w-3.5 h-3.5" />
                    {{ group.establishmentCount }} établissement{{ group.establishmentCount > 1 ? 's' : '' }}
                  </span>
                </div>
                <p v-if="group.description" class="text-sm text-slate-600">{{ group.description }}</p>
                <div class="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                    <Package class="w-3.5 h-3.5 text-slate-500" />
                    {{ countEnabled(group.productRules) }} règles produits
                  </span>
                  <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                    <Users class="w-3.5 h-3.5 text-slate-500" />
                    {{ countEnabled(group.customerRules) }} règles clients
                  </span>
                </div>
              </div>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" @click="openEditGroupDialog(group)">
                  <Settings class="w-4 h-4 mr-1" />
                  Configurer
                </Button>
                <Button variant="outline" size="sm" @click="openDeleteGroupDialog(group)">
                  <Trash2 class="w-4 h-4" />
                </Button>
              </div>
            </div>

            <!-- Établissements du groupe -->
            <div class="mt-4 space-y-3">
              <h4 class="text-sm font-medium text-slate-800">Établissements synchronisés</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="estab in group.establishments"
                  :key="estab.id"
                  class="px-3 py-1 rounded-full border border-slate-200 bg-white text-sm text-slate-700 shadow-sm"
                >
                  {{ estab.name }}
                  <span v-if="estab.city" class="text-slate-500">• {{ estab.city }}</span>
                </span>
              </div>
            </div>

            <!-- Règles de synchronisation -->
            <div class="mt-6 grid md:grid-cols-2 gap-4">
              <!-- Règles produits -->
              <div class="rounded-xl border border-slate-200/70 bg-white/70 p-4">
                <h4 class="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Package class="w-4 h-4" />
                  Règles Produits
                </h4>
                <div class="space-y-2 text-sm">
                  <RuleItem label="Nom" :enabled="group.productRules?.syncName" />
                  <RuleItem label="Description" :enabled="group.productRules?.syncDescription" />
                  <RuleItem label="Code-barres" :enabled="group.productRules?.syncBarcode" />
                  <RuleItem label="Catégorie" :enabled="group.productRules?.syncCategory" />
                  <RuleItem label="Fournisseur" :enabled="group.productRules?.syncSupplier" />
                  <RuleItem label="Marque" :enabled="group.productRules?.syncBrand" />
                  <RuleItem label="Prix TTC" :enabled="group.productRules?.syncPriceTtc" />
                  <RuleItem label="Prix HT" :enabled="group.productRules?.syncPriceHt" />
                  <RuleItem label="TVA" :enabled="group.productRules?.syncTva" />
                  <RuleItem label="Image" :enabled="group.productRules?.syncImage" />
                  <RuleItem label="Variations" :enabled="group.productRules?.syncVariations" />
                </div>
              </div>

              <!-- Règles clients -->
              <div class="rounded-xl border border-slate-200/70 bg-white/70 p-4">
                <h4 class="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users class="w-4 h-4" />
                  Règles Clients
                </h4>
                <div class="space-y-2 text-sm">
                  <RuleItem label="Informations (nom, prénom)" :enabled="group.customerRules?.syncCustomerInfo" />
                  <RuleItem label="Contact (email, tél)" :enabled="group.customerRules?.syncCustomerContact" />
                  <RuleItem label="Adresse" :enabled="group.customerRules?.syncCustomerAddress" />
                  <RuleItem label="RGPD" :enabled="group.customerRules?.syncCustomerGdpr" />
                  <RuleItem label="Programme fidélité" :enabled="group.customerRules?.syncLoyaltyProgram" />
                  <RuleItem label="Remise" :enabled="group.customerRules?.syncDiscount" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <EmptyState
        v-if="syncGroups.length === 0"
        :icon="Network"
        title="Aucun groupe de synchronisation"
        description="Créez votre premier groupe pour commencer à synchroniser vos établissements"
      >
        <Button @click="openCreateGroupDialog" class="mt-4">
          <Plus class="w-4 h-4 mr-2" />
          Créer un groupe
        </Button>
      </EmptyState>
    </div>

    <!-- Dialog: Créer un groupe -->
    <Dialog v-model:open="createGroupDialogOpen">
      <DialogContent class="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau groupe de synchronisation</DialogTitle>
          <DialogDescription>
            Créez un groupe pour synchroniser les données entre plusieurs établissements
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-6 py-4">
          <!-- Informations de base -->
          <div class="space-y-4">
            <div class="space-y-2">
              <Label for="group-name">Nom du groupe *</Label>
              <Input
                id="group-name"
                v-model="newGroup.name"
                placeholder="Ex: Réseau France"
              />
            </div>
            <div class="space-y-2">
              <Label for="group-description">Description</Label>
              <Textarea
                id="group-description"
                v-model="newGroup.description"
                placeholder="Description optionnelle du groupe"
                rows="2"
              />
            </div>
          </div>

          <!-- Sélection des établissements -->
          <div class="space-y-4">
            <Label>Établissements à synchroniser *</Label>
            <p class="text-sm text-gray-600">Sélectionnez au moins 2 établissements</p>
            <div class="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto border rounded-lg p-3">
              <label
                v-for="estab in availableEstablishments"
                :key="estab.id"
                class="flex items-center space-x-2 cursor-pointer"
              >
                <Checkbox
                  :model-value="newGroup.establishmentIds.includes(estab.id)"
                  @update:model-value="(checked) => toggleEstablishmentSelection(estab.id, checked)"
                />
                <span class="text-sm">
                  {{ estab.name }}
                  <span v-if="estab.city" class="text-gray-500">• {{ estab.city }}</span>
                </span>
              </label>
            </div>
          </div>

          <!-- Règles de synchronisation - Produits -->
          <div class="space-y-4">
            <h3 class="font-semibold flex items-center gap-2">
              <Package class="w-4 h-4" />
              Règles de synchronisation des produits
            </h3>
            <div class="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-name" v-model:model-value="newGroup.productRules.syncName" />
                <Label for="sync-name" class="cursor-pointer text-gray-900">Nom du produit</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-description" v-model:model-value="newGroup.productRules.syncDescription" />
                <Label for="sync-description" class="cursor-pointer text-gray-900">Description</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-barcode" v-model:model-value="newGroup.productRules.syncBarcode" />
                <Label for="sync-barcode" class="cursor-pointer text-gray-900">Code-barres</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-category" v-model:model-value="newGroup.productRules.syncCategory" />
                <Label for="sync-category" class="cursor-pointer text-gray-900">Catégorie</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-supplier" v-model:model-value="newGroup.productRules.syncSupplier" />
                <Label for="sync-supplier" class="cursor-pointer text-gray-900">Fournisseur</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-brand" v-model:model-value="newGroup.productRules.syncBrand" />
                <Label for="sync-brand" class="cursor-pointer text-gray-900">Marque</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-price-ht" v-model:model-value="newGroup.productRules.syncPriceHt" />
                <Label for="sync-price-ht" class="cursor-pointer text-gray-900">Prix HT</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-price-ttc" v-model:model-value="newGroup.productRules.syncPriceTtc" />
                <Label for="sync-price-ttc" class="cursor-pointer text-gray-900">Prix TTC</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-tva" v-model:model-value="newGroup.productRules.syncTva" />
                <Label for="sync-tva" class="cursor-pointer text-gray-900">TVA</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-image" v-model:model-value="newGroup.productRules.syncImage" />
                <Label for="sync-image" class="cursor-pointer text-gray-900">Image</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-variations" v-model:model-value="newGroup.productRules.syncVariations" />
                <Label for="sync-variations" class="cursor-pointer text-gray-900">Variations</Label>
              </div>
            </div>
          </div>

          <!-- Règles de synchronisation - Clients -->
          <div class="space-y-4">
            <h3 class="font-semibold flex items-center gap-2">
              <Users class="w-4 h-4" />
              Règles de synchronisation des clients
            </h3>
            <div class="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-customer-info" v-model:model-value="newGroup.customerRules.syncCustomerInfo" />
                <Label for="sync-customer-info" class="cursor-pointer text-gray-900">Informations (nom, prénom)</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-customer-contact" v-model:model-value="newGroup.customerRules.syncCustomerContact" />
                <Label for="sync-customer-contact" class="cursor-pointer text-gray-900">Contact (email, tél)</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-customer-address" v-model:model-value="newGroup.customerRules.syncCustomerAddress" />
                <Label for="sync-customer-address" class="cursor-pointer text-gray-900">Adresse</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-customer-gdpr" v-model:model-value="newGroup.customerRules.syncCustomerGdpr" />
                <Label for="sync-customer-gdpr" class="cursor-pointer text-gray-900">Consentements RGPD</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-loyalty" v-model:model-value="newGroup.customerRules.syncLoyaltyProgram" />
                <Label for="sync-loyalty" class="cursor-pointer text-gray-900">Programme fidélité</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="sync-discount" v-model:model-value="newGroup.customerRules.syncDiscount" />
                <Label for="sync-discount" class="cursor-pointer text-gray-900">Remise</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="createGroupDialogOpen = false">
            Annuler
          </Button>
          <Button @click="createGroup">
            Créer le groupe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Configurer un groupe -->
    <Dialog v-model:open="editGroupDialogOpen">
      <DialogContent class="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuration du groupe</DialogTitle>
          <DialogDescription>
            Modifier les règles de synchronisation pour {{ editGroup.name }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-6 py-4">
          <!-- Règles produits -->
          <div class="space-y-4">
            <h3 class="font-semibold flex items-center gap-2">
              <Package class="w-4 h-4" />
              Règles Produits
            </h3>
            <div class="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-name" v-model:model-value="editGroup.productRules.syncName" />
                <Label for="edit-sync-name" class="cursor-pointer text-gray-900">Nom du produit</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-description" v-model:model-value="editGroup.productRules.syncDescription" />
                <Label for="edit-sync-description" class="cursor-pointer text-gray-900">Description</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-barcode" v-model:model-value="editGroup.productRules.syncBarcode" />
                <Label for="edit-sync-barcode" class="cursor-pointer text-gray-900">Code-barres</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-category" v-model:model-value="editGroup.productRules.syncCategory" />
                <Label for="edit-sync-category" class="cursor-pointer text-gray-900">Catégorie</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-supplier" v-model:model-value="editGroup.productRules.syncSupplier" />
                <Label for="edit-sync-supplier" class="cursor-pointer text-gray-900">Fournisseur</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-brand" v-model:model-value="editGroup.productRules.syncBrand" />
                <Label for="edit-sync-brand" class="cursor-pointer text-gray-900">Marque</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-price-ht" v-model:model-value="editGroup.productRules.syncPriceHt" />
                <Label for="edit-sync-price-ht" class="cursor-pointer text-gray-900">Prix HT</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-price-ttc" v-model:model-value="editGroup.productRules.syncPriceTtc" />
                <Label for="edit-sync-price-ttc" class="cursor-pointer text-gray-900">Prix TTC</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-tva" v-model:model-value="editGroup.productRules.syncTva" />
                <Label for="edit-sync-tva" class="cursor-pointer text-gray-900">TVA</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-image" v-model:model-value="editGroup.productRules.syncImage" />
                <Label for="edit-sync-image" class="cursor-pointer text-gray-900">Image</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-variations" v-model:model-value="editGroup.productRules.syncVariations" />
                <Label for="edit-sync-variations" class="cursor-pointer text-gray-900">Variations</Label>
              </div>
            </div>
          </div>

          <!-- Règles clients -->
          <div class="space-y-4">
            <h3 class="font-semibold flex items-center gap-2">
              <Users class="w-4 h-4" />
              Règles Clients
            </h3>
            <div class="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-customer-info" v-model:model-value="editGroup.customerRules.syncCustomerInfo" />
                <Label for="edit-sync-customer-info" class="cursor-pointer text-gray-900">Informations (nom, prénom)</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-customer-contact" v-model:model-value="editGroup.customerRules.syncCustomerContact" />
                <Label for="edit-sync-customer-contact" class="cursor-pointer text-gray-900">Contact (email, tél)</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-customer-address" v-model:model-value="editGroup.customerRules.syncCustomerAddress" />
                <Label for="edit-sync-customer-address" class="cursor-pointer text-gray-900">Adresse</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-customer-gdpr" v-model:model-value="editGroup.customerRules.syncCustomerGdpr" />
                <Label for="edit-sync-customer-gdpr" class="cursor-pointer text-gray-900">Consentements RGPD</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-loyalty" v-model:model-value="editGroup.customerRules.syncLoyaltyProgram" />
                <Label for="edit-sync-loyalty" class="cursor-pointer text-gray-900">Programme fidélité</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox id="edit-sync-discount" v-model:model-value="editGroup.customerRules.syncDiscount" />
                <Label for="edit-sync-discount" class="cursor-pointer text-gray-900">Remise</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="editGroupDialogOpen = false">
            Annuler
          </Button>
          <Button @click="updateGroupRules">
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: Supprimer un groupe -->
    <ConfirmDialog
      v-model:open="deleteGroupDialogOpen"
      title="Supprimer le groupe de synchronisation"
      description="Êtes-vous sûr de vouloir supprimer ce groupe ? Les données des établissements resteront intactes, mais la synchronisation sera désactivée."
      confirm-label="Supprimer"
      @confirm="deleteGroup"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import {
  Plus,
  ArrowLeft,
  Building2,
  Network,
  Settings,
  Trash2,
  Package,
  Users,
  Info,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useToast } from '@/composables/useToast'

// Import du composant RuleItem
import RuleItem from '~/components/sync/RuleItem.vue'

const toast = useToast()

interface Establishment {
  id: number
  name: string
  city?: string
}

interface SyncGroup {
  id: number
  name: string
  description?: string
  establishmentCount: number
  establishments: Establishment[]
  productRules?: any
  customerRules?: any
}

// Helpers
function countEnabled(rules?: Record<string, boolean>) {
  if (!rules) return 0
  return Object.values(rules).filter(Boolean).length
}

// State
const loading = ref(true)
const syncGroups = ref<SyncGroup[]>([])
const availableEstablishments = ref<Establishment[]>([])

// Dialog states
const createGroupDialogOpen = ref(false)
const editGroupDialogOpen = ref(false)
const deleteGroupDialogOpen = ref(false)

const newGroup = reactive({
  name: '',
  description: '',
  establishmentIds: [] as number[],
  productRules: {
    syncName: true,
    syncDescription: true,
    syncBarcode: true,
    syncCategory: true,
    syncSupplier: true,
    syncBrand: true,
    syncPriceHt: true,
    syncPriceTtc: false,
    syncTva: true,
    syncImage: true,
    syncVariations: true,
  },
  customerRules: {
    syncCustomerInfo: true,
    syncCustomerContact: true,
    syncCustomerAddress: true,
    syncCustomerGdpr: true,
    syncLoyaltyProgram: false,
    syncDiscount: false,
  },
})

const editGroup = reactive({
  id: 0,
  name: '',
  productRules: {
    syncName: true,
    syncDescription: true,
    syncBarcode: true,
    syncCategory: true,
    syncSupplier: true,
    syncBrand: true,
    syncPriceHt: true,
    syncPriceTtc: false,
    syncTva: true,
    syncImage: true,
    syncVariations: true,
  },
  customerRules: {
    syncCustomerInfo: true,
    syncCustomerContact: true,
    syncCustomerAddress: true,
    syncCustomerGdpr: true,
    syncLoyaltyProgram: false,
    syncDiscount: false,
  },
})

const selectedGroup = ref<SyncGroup | null>(null)

// Charger les données
async function loadSyncGroups() {
  try {
    loading.value = true
    const response = await $fetch<{ success: boolean; syncGroups: SyncGroup[] }>('/api/sync-groups')
    syncGroups.value = response.syncGroups
  } catch (error) {
    console.error('Erreur lors du chargement des groupes:', error)
    toast.error('Erreur lors du chargement des groupes de synchronisation')
  } finally {
    loading.value = false
  }
}

async function loadEstablishments() {
  try {
    const response = await $fetch<{ success: boolean; establishments: any[] }>('/api/establishments')
    availableEstablishments.value = response.establishments
      .filter((e: any) => e.isActive)
      .map((e: any) => ({
        id: e.id,
        name: e.name,
        city: e.city,
      }))
  } catch (error) {
    console.error('Erreur lors du chargement des établissements:', error)
  }
}

// Toggle selection établissement
function toggleEstablishmentSelection(id: number, checked: boolean | 'indeterminate') {
  console.log('toggleEstablishmentSelection appelé avec:', { id, checked })

  if (checked === 'indeterminate') {
    return
  }

  const index = newGroup.establishmentIds.indexOf(id)

  if (checked && index === -1) {
    // Ajouter si coché et pas déjà dans la liste
    newGroup.establishmentIds.push(id)
  } else if (!checked && index > -1) {
    // Retirer si décoché et présent dans la liste
    newGroup.establishmentIds.splice(index, 1)
  }

  console.log('Établissements sélectionnés:', newGroup.establishmentIds)
}

// Créer un groupe
function openCreateGroupDialog() {
  // Réinitialiser le formulaire
  newGroup.name = ''
  newGroup.description = ''
  newGroup.establishmentIds = []
  newGroup.productRules.syncName = true
  newGroup.productRules.syncDescription = true
  newGroup.productRules.syncBarcode = true
  newGroup.productRules.syncCategory = true
  newGroup.productRules.syncSupplier = true
  newGroup.productRules.syncBrand = true
  newGroup.productRules.syncPriceHt = true
  newGroup.productRules.syncPriceTtc = false
  newGroup.productRules.syncTva = true
  newGroup.productRules.syncImage = true
  newGroup.productRules.syncVariations = true
  newGroup.customerRules.syncCustomerInfo = true
  newGroup.customerRules.syncCustomerContact = true
  newGroup.customerRules.syncCustomerAddress = true
  newGroup.customerRules.syncCustomerGdpr = true
  newGroup.customerRules.syncLoyaltyProgram = false
  newGroup.customerRules.syncDiscount = false

  createGroupDialogOpen.value = true
}

async function createGroup() {
  console.log('Création du groupe avec:', newGroup)

  if (!newGroup.name.trim()) {
    toast.error('Le nom du groupe est obligatoire')
    return
  }

  if (newGroup.establishmentIds.length < 2) {
    console.log('Nombre d\'établissements:', newGroup.establishmentIds.length)
    toast.error('Sélectionnez au moins 2 établissements')
    return
  }

  try {
    await $fetch('/api/sync-groups/create', {
      method: 'POST',
      body: newGroup,
    })

    toast.success('Groupe de synchronisation créé avec succès')
    createGroupDialogOpen.value = false
    await loadSyncGroups()
  } catch (error: any) {
    console.error('Erreur lors de la création du groupe:', error)
    toast.error(error.data?.message || 'Impossible de créer le groupe')
  }
}

// Modifier un groupe
function openEditGroupDialog(group: SyncGroup) {
  selectedGroup.value = group
  editGroup.id = group.id
  editGroup.name = group.name
  Object.assign(
    editGroup.productRules,
    {
      syncName: true,
      syncDescription: true,
      syncBarcode: true,
      syncCategory: true,
      syncSupplier: true,
      syncBrand: true,
      syncPriceHt: true,
      syncPriceTtc: false,
      syncTva: true,
      syncImage: true,
      syncVariations: true,
    },
    group.productRules,
  )
  Object.assign(
    editGroup.customerRules,
    {
      syncCustomerInfo: true,
      syncCustomerContact: true,
      syncCustomerAddress: true,
      syncCustomerGdpr: true,
      syncLoyaltyProgram: false,
      syncDiscount: false,
    },
    group.customerRules,
  )
  editGroupDialogOpen.value = true
}

async function updateGroupRules() {
  if (!selectedGroup.value) return

  try {
    // Mettre à jour les règles produits
    await $fetch(`/api/sync-groups/${selectedGroup.value.id}/rules`, {
      method: 'PATCH',
      body: {
        entityType: 'product',
        ...editGroup.productRules,
      },
    })

    // Mettre à jour les règles clients
    await $fetch(`/api/sync-groups/${selectedGroup.value.id}/rules`, {
      method: 'PATCH',
      body: {
        entityType: 'customer',
        ...editGroup.customerRules,
      },
    })

    toast.success('Règles de synchronisation mises à jour')
    editGroupDialogOpen.value = false
    await loadSyncGroups()
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour:', error)
    toast.error(error.data?.message || 'Impossible de mettre à jour les règles')
  }
}

// Supprimer un groupe
function openDeleteGroupDialog(group: SyncGroup) {
  selectedGroup.value = group
  deleteGroupDialogOpen.value = true
}

async function deleteGroup() {
  if (!selectedGroup.value) return

  try {
    await $fetch(`/api/sync-groups/${selectedGroup.value.id}/delete`, {
      method: 'DELETE',
    })

    toast.success('Groupe supprimé avec succès')
    deleteGroupDialogOpen.value = false
    await loadSyncGroups()
  } catch (error) {
    console.error('Erreur lors de la suppression:', error)
    toast.error('Impossible de supprimer le groupe')
  }
}

// Charger au montage
onMounted(async () => {
  await Promise.all([
    loadSyncGroups(),
    loadEstablishments(),
  ])
})
</script>
