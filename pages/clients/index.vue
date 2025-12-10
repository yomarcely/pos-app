<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Gestion des clients"
      :description="`${filteredCount} client(s)`"
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
                class="hover:bg-muted/50 transition-colors"
              >
                <!-- Nom -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User class="h-5 w-5 text-primary" />
                    </div>
                    <div class="ml-4">
                      <div class="font-medium">{{ getFullName(client) }}</div>
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
                    <Button variant="ghost" size="sm" @click="viewClient(client)">
                      <Eye class="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" @click="editClient(client)">
                      <Edit class="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" @click="deleteClient(client)">
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, onMounted, watch } from 'vue'
import { Plus, User, Phone, Star, Eye, Edit, Trash2, Users } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  metadata: any
  gdprConsent: boolean | null
  gdprConsentDate: string | null
  marketingConsent: boolean | null
  loyaltyProgram: boolean | null
  discount: string | null
  notes: string | null
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
const filteredCount = ref(0)
const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

// Debounced search
let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadClients()
  }, 300)
}

// Charger les clients
async function loadClients() {
  try {
    loading.value = true

    const params: any = {}
    if (searchQuery.value && searchQuery.value.trim() !== '') {
      params.search = searchQuery.value.trim()
    }
    if (selectedEstablishmentId.value) params.establishmentId = selectedEstablishmentId.value

    const response = await $fetch('/api/clients', { params })
    clients.value = response.clients as unknown as Customer[]
    filteredCount.value = response.count
  } catch (error) {
    console.error('Erreur lors du chargement des clients:', error)
    toast.error('Erreur lors du chargement des clients')
  } finally {
    loading.value = false
  }
}

// Obtenir le nom complet
function getFullName(client: Customer): string {
  const parts = []
  if (client.firstName) parts.push(client.firstName)
  if (client.lastName) parts.push(client.lastName)
  return parts.length > 0 ? parts.join(' ') : 'Client sans nom'
}

// Actions
function viewClient(client: Customer) {
  navigateTo(`/clients/${client.id}`)
}

function editClient(client: Customer) {
  navigateTo(`/clients/${client.id}/edit`)
}

async function deleteClient(client: Customer) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer "${getFullName(client)}" ?`)) return

  try {
    await $fetch(`/api/clients/${client.id}`, {
      method: 'DELETE',
    })

    toast.success('Client supprimé avec succès')
    await loadClients()
  } catch (error: any) {
    console.error('Erreur lors de la suppression du client:', error)
    toast.error(error.data?.message || 'Erreur lors de la suppression du client')
  }
}

// Charger au montage
onMounted(async () => {
  await initializeEstablishments()
  await loadClients()
})

watch(selectedEstablishmentId, async () => {
  await loadClients()
})
</script>
