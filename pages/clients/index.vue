<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Gestion des clients"
      :description="`${totalCount} client(s)`"
    >
      <template #actions>
        <Button @click="navigateTo('/clients/create')">
          <Plus class="w-4 h-4 mr-2" />
          Nouveau client
        </Button>
      </template>
    </PageHeader>

    <!-- Barre de recherche -->
    <div class="flex items-center gap-4">
      <div class="flex-1 max-w-md">
        <Input
          v-model="searchQuery"
          placeholder="Rechercher un client (nom, email, téléphone)..."
          @input="debouncedSearch"
        />
      </div>

      <!-- Toggle archivés (comme les produits) -->
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          :model-value="showArchived"
          @update:model-value="(value) => { showArchived = !!value }"
        />
        <Archive class="w-4 h-4 text-muted-foreground" />
        Voir uniquement les archivés
      </label>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des clients..." />

    <!-- Table des clients -->
    <Card v-else-if="clients.length > 0">
      <CardContent class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-muted/50 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nom
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ville
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Téléphone
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Chiffre d'affaire
                </th>
                <th class="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Points fidélité
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="client in clients"
                :key="client.id"
                class="hover:bg-muted/50 transition-colors cursor-pointer"
                @click="navigateTo(`/clients/${client.id}/edit`)"
              >
                <!-- Nom -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User class="h-5 w-5 text-primary" />
                    </div>
                    <div class="ml-4">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">{{ getFullName(client) }}</span>
                        <Badge v-if="client.isAnonymized" variant="outline" class="text-xs">Anonymisé</Badge>
                        <Badge v-else-if="client.isArchived" variant="outline" class="text-xs">Archivé</Badge>
                      </div>
                      <div v-if="client.email" class="text-xs text-muted-foreground">
                        {{ client.email }}
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Ville -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span v-if="client.city" class="text-sm">{{ client.city }}</span>
                  <span v-else class="text-sm text-muted-foreground">-</span>
                </td>

                <!-- Téléphone -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div v-if="client.phone" class="flex items-center gap-1 text-sm">
                    <Phone class="h-3 w-3 text-muted-foreground" />
                    <span>{{ client.phone }}</span>
                  </div>
                  <span v-else class="text-sm text-muted-foreground">-</span>
                </td>

                <!-- Chiffre d'affaire -->
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <span class="font-medium">{{ formatPrice(client.totalRevenue) }}</span>
                </td>

                <!-- Points fidélité -->
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  <Badge v-if="client.loyaltyProgram" variant="secondary" class="gap-1">
                    <Star class="h-3 w-3" />
                    {{ client.loyaltyPoints || 0 }}
                  </Badge>
                  <span v-else class="text-muted-foreground text-sm">-</span>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" @click.stop="editClient(client)">
                      <Edit class="w-4 h-4" />
                    </Button>
                    <Button
                      v-if="client.isArchived"
                      variant="ghost"
                      size="sm"
                      title="Désarchiver"
                      @click.stop="unarchiveClient(client)"
                    >
                      <ArchiveRestore class="w-4 h-4" />
                    </Button>
                    <Button
                      v-else
                      variant="ghost"
                      size="sm"
                      title="Archiver"
                      @click.stop="archiveClient(client)"
                    >
                      <Archive class="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" @click.stop="deleteClient(client)">
                      <Trash2 class="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <!-- État vide -->
    <EmptyState
      v-else-if="!loading && clients.length === 0"
      :icon="Users"
      title="Aucun client trouvé"
      :description="searchQuery ? 'Essayez de modifier votre recherche' : 'Créez votre premier client pour commencer'"
    />

    <!-- Pagination -->
    <Pagination
      v-if="!loading && totalCount > pageSize"
      v-slot="{ page }"
      v-model:page="currentPage"
      :items-per-page="pageSize"
      :total="totalCount"
      :sibling-count="1"
      show-edges
    >
      <PaginationContent v-slot="{ items }">
        <PaginationPrevious />
        <template v-for="(item, index) in items" :key="index">
          <PaginationItem
            v-if="item.type === 'page'"
            :value="item.value"
            :is-active="item.value === page"
          >
            {{ item.value }}
          </PaginationItem>
          <PaginationEllipsis v-else :index="index" />
        </template>
        <PaginationNext />
      </PaginationContent>
    </Pagination>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, onMounted, watch } from 'vue'
import { Plus, User, Phone, Star, Edit, Trash2, Users, Archive, ArchiveRestore } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import PageHeader from '@/components/common/PageHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

// Fonction pour formater les prix
function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price)
}

const toast = useToast()

interface Customer {
  id: number
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  address: string | null
  metadata: Record<string, unknown> | null
  gdprConsent: boolean | null
  gdprConsentDate: string | null
  marketingConsent: boolean | null
  loyaltyProgram: boolean | null
  discount: string | null
  notes: string | null
  isArchived: boolean
  isAnonymized: boolean
  createdAt: string
  updatedAt: string
  city: string | null
  totalRevenue: number
  loyaltyPoints: number
}

// State
const loading = ref(true)
const clients = ref<Customer[]>([])
const searchQuery = ref('')
const showArchived = ref(false)
const filteredCount = ref(0)
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(30)
const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

interface PaginatedClientsResponse {
  success: boolean
  clients: Customer[]
  count: number
  meta: {
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }
}

// Debounced search — reset à la page 1 quand on tape
let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadClients()
  }, 300)
}

// Charger les clients
async function loadClients() {
  try {
    loading.value = true

    const params: Record<string, string | number> = {
      page: currentPage.value,
      limit: pageSize.value,
    }
    if (searchQuery.value && searchQuery.value.trim() !== '') {
      params.search = searchQuery.value.trim()
    }
    if (showArchived.value) params.onlyArchived = 'true'
    if (selectedEstablishmentId.value) params.establishmentId = selectedEstablishmentId.value

    const response = await $fetch<PaginatedClientsResponse>('/api/clients', { params })
    clients.value = response.clients
    filteredCount.value = response.count
    totalCount.value = response.meta?.pagination?.total ?? response.count
  } catch (error) {
    console.error('Erreur lors du chargement des clients:', error)
    toast.error('Erreur lors du chargement des clients')
  } finally {
    loading.value = false
  }
}

watch(currentPage, () => {
  loadClients()
})

// Bascule archivés : retour page 1 + rechargement
watch(showArchived, async () => {
  if (currentPage.value !== 1) {
    currentPage.value = 1 // le watcher currentPage déclenchera loadClients
  } else {
    await loadClients()
  }
})

// Obtenir le nom complet
function getFullName(client: Customer): string {
  const parts = []
  if (client.firstName) parts.push(client.firstName)
  if (client.lastName) parts.push(client.lastName)
  return parts.length > 0 ? parts.join(' ') : 'Client sans nom'
}

// Actions
function editClient(client: Customer) {
  navigateTo(`/clients/${client.id}/edit`)
}

async function archiveClient(client: Customer) {
  try {
    await $fetch(`/api/clients/${client.id}/archive`, { method: 'POST' })
    toast.success('Client archivé avec succès')
    await loadClients()
  } catch (error: unknown) {
    console.error('Erreur lors de l\'archivage du client:', error)
    toast.error(extractFetchError(error, 'Erreur lors de l\'archivage du client'))
  }
}

async function unarchiveClient(client: Customer) {
  try {
    await $fetch(`/api/clients/${client.id}/unarchive`, { method: 'POST' })
    toast.success('Client désarchivé avec succès')
    await loadClients()
  } catch (error: unknown) {
    console.error('Erreur lors du désarchivage du client:', error)
    toast.error(extractFetchError(error, 'Erreur lors du désarchivage du client'))
  }
}

async function deleteClient(client: Customer) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer "${getFullName(client)}" ?`)) return

  try {
    await $fetch(`/api/clients/${client.id}`, {
      method: 'DELETE',
    })

    toast.success('Client supprimé avec succès')
    await loadClients()
  } catch (error: unknown) {
    console.error('Erreur lors de la suppression du client:', error)
    toast.error(extractFetchError(error, 'Erreur lors de la suppression du client'))
  }
}

// Charger au montage
onMounted(async () => {
  await initializeEstablishments()
  await loadClients()
})

watch(selectedEstablishmentId, async () => {
  // Reset à la page 1 : les clients diffèrent par établissement
  if (currentPage.value !== 1) {
    currentPage.value = 1 // watcher déclenchera loadClients
  } else {
    await loadClients()
  }
})
</script>
