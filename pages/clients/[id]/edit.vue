<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      :title="`Modifier ${clientName}`"
      description="Modifier les informations du client"
    />

    <!-- Loading -->
    <LoadingSpinner v-if="loadingClient" text="Chargement du client..." />

    <!-- Statistiques client -->
    <div v-else-if="form" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Chiffre d'affaire total -->
      <Card>
        <CardContent class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Chiffre d'affaire total</p>
              <p class="text-2xl font-bold">{{ formatPrice(clientStats.totalRevenue) }}</p>
            </div>
            <div class="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <TrendingUp class="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Points de fidélité -->
      <Card>
        <CardContent class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Points de fidélité</p>
              <p class="text-2xl font-bold">{{ clientStats.loyaltyPoints }}</p>
              <p v-if="form.loyaltyProgram" class="text-xs text-muted-foreground mt-1">
                Programme actif
              </p>
              <p v-else class="text-xs text-muted-foreground mt-1">
                Non inscrit
              </p>
            </div>
            <div class="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
              <Star class="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Nombre d'achats -->
      <Card>
        <CardContent class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Nombre d'achats</p>
              <p class="text-2xl font-bold">{{ clientStats.purchaseCount }}</p>
              <Button
                variant="link"
                class="p-0 h-auto mt-1 text-xs"
                @click="showPurchaseHistory = true"
              >
                Voir l'historique
              </Button>
            </div>
            <div class="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <ShoppingBag class="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Formulaire -->
    <Card v-if="form && !loadingClient">
      <CardContent class="p-6">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Informations personnelles -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Informations personnelles</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Prénom -->
              <div class="space-y-2">
                <Label for="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  v-model="form.firstName"
                  placeholder="Jean"
                />
              </div>

              <!-- Nom -->
              <div class="space-y-2">
                <Label for="lastName">Nom</Label>
                <Input
                  id="lastName"
                  v-model="form.lastName"
                  placeholder="Dupont"
                />
              </div>

              <!-- Email -->
              <div class="space-y-2">
                <Label for="email">Email</Label>
                <Input
                  id="email"
                  v-model="form.email"
                  type="email"
                  placeholder="jean.dupont@example.com"
                />
              </div>

              <!-- Téléphone -->
              <div class="space-y-2">
                <Label for="phone">Téléphone</Label>
                <Input
                  id="phone"
                  v-model="form.phone"
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>
          </div>

          <!-- Adresse -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Adresse</h3>

            <div class="space-y-4">
              <!-- Adresse complète -->
              <div class="space-y-2">
                <Label for="address">Adresse</Label>
                <Textarea
                  id="address"
                  v-model="form.address"
                  placeholder="12 rue de la Paix"
                  rows="2"
                />
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Code postal -->
                <div class="space-y-2">
                  <Label for="postalCode">Code postal</Label>
                  <div class="relative">
                    <Input
                      id="postalCode"
                      v-model="form.postalCode"
                      placeholder="75001"
                      @input="handlePostalCodeChange"
                      :disabled="loadingPostalCode"
                    />
                    <Loader2
                      v-if="loadingPostalCode"
                      class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground"
                    />
                  </div>
                  <p v-if="postalCodeError" class="text-xs text-destructive">
                    {{ postalCodeError }}
                  </p>

                  <!-- Dropdown pour sélectionner la ville si plusieurs résultats -->
                  <div
                    v-if="availableCities.length > 1"
                    class="mt-2 border rounded-md bg-card shadow-sm"
                  >
                    <div class="p-2 text-xs text-muted-foreground border-b">
                      {{ availableCities.length }} villes trouvées - Sélectionnez :
                    </div>
                    <div class="max-h-48 overflow-y-auto">
                      <button
                        v-for="city in availableCities"
                        :key="city.code"
                        type="button"
                        @click="selectCity(city.nom)"
                        class="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        :class="{ 'bg-accent/50': form.city === city.nom }"
                      >
                        {{ city.nom }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Ville -->
                <div class="space-y-2">
                  <Label for="city">Ville</Label>
                  <Input
                    id="city"
                    v-model="form.city"
                    placeholder="Paris"
                  />
                </div>

                <!-- Pays -->
                <div class="space-y-2">
                  <Label for="country">Pays</Label>
                  <Input
                    id="country"
                    v-model="form.country"
                    placeholder="France"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Programme de fidélité & Remise -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Fidélité & Remise</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Programme de fidélité -->
              <div class="flex items-center space-x-2">
                <Checkbox
                  id="loyaltyProgram"
                  v-model:model-value="form.loyaltyProgram"
                />
                <Label for="loyaltyProgram" class="cursor-pointer">
                  Inscrire au programme de fidélité
                </Label>
              </div>

              <!-- Remise -->
              <div class="space-y-2">
                <Label for="discount">Remise permanente (%)</Label>
                <Input
                  id="discount"
                  v-model.number="form.discount"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <!-- RGPD & Marketing -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Consentements RGPD</h3>

            <div class="space-y-3">
              <!-- RGPD Consent -->
              <div class="flex items-start space-x-2">
                <Checkbox
                  id="gdprConsent"
                  v-model:model-value="form.gdprConsent"
                />
                <div class="grid gap-1.5 leading-none">
                  <Label for="gdprConsent" class="cursor-pointer font-medium">
                    Consentement RGPD <span class="text-destructive">*</span>
                  </Label>
                  <p class="text-sm text-muted-foreground">
                    Le client consent à la collecte et au traitement de ses données personnelles
                  </p>
                </div>
              </div>

              <!-- Marketing Consent -->
              <div class="flex items-start space-x-2">
                <Checkbox
                  id="marketingConsent"
                  v-model:model-value="form.marketingConsent"
                />
                <div class="grid gap-1.5 leading-none">
                  <Label for="marketingConsent" class="cursor-pointer font-medium">
                    Communication marketing
                  </Label>
                  <p class="text-sm text-muted-foreground">
                    Le client accepte de recevoir des communications marketing (emails, SMS)
                  </p>
                </div>
              </div>

              <!-- SMS Authorization -->
              <div class="flex items-start space-x-2">
                <Checkbox
                  id="authorizeSms"
                  v-model:model-value="form.authorizeSms"
                />
                <div class="grid gap-1.5 leading-none">
                  <Label for="authorizeSms" class="cursor-pointer font-medium">
                    Autorisation SMS
                  </Label>
                  <p class="text-sm text-muted-foreground">
                    Le client accepte de recevoir des SMS
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes & Alertes -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Informations complémentaires</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Notes -->
              <div class="space-y-2">
                <Label for="notes">Notes internes</Label>
                <Textarea
                  id="notes"
                  v-model="form.notes"
                  placeholder="Notes ou remarques sur le client..."
                  rows="3"
                />
              </div>

              <!-- Alertes -->
              <div class="space-y-2">
                <Label for="alerts">Alertes</Label>
                <Textarea
                  id="alerts"
                  v-model="form.alerts"
                  placeholder="Alertes importantes (ex: impayés, restrictions...)..."
                  rows="3"
                />
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              @click="navigateTo('/clients')"
              :disabled="loading"
            >
              Annuler
            </Button>
            <Button type="submit" :disabled="loading || !form.gdprConsent">
              <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
              Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <!-- Modale Historique des achats -->
    <Dialog v-model:open="showPurchaseHistory">
      <DialogContent class="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique des achats</DialogTitle>
          <DialogDescription>
            Liste des achats effectués par {{ clientName }}
          </DialogDescription>
        </DialogHeader>

        <!-- Loading -->
        <LoadingSpinner v-if="loadingPurchases" text="Chargement de l'historique..." />

        <!-- Liste des achats -->
        <div v-else-if="purchases.length > 0" class="space-y-4">
          <div
            v-for="purchase in purchases"
            :key="purchase.id"
            class="border rounded-lg overflow-hidden"
          >
            <!-- En-tête du ticket -->
            <div class="bg-muted/50 p-4 border-b">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <ShoppingBag class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ purchase.ticketNumber }}</span>
                    <Badge :variant="purchase.status === 'completed' ? 'default' : 'secondary'">
                      {{ purchase.status === 'completed' ? 'Complété' : purchase.status }}
                    </Badge>
                  </div>
                  <span class="text-sm text-muted-foreground">
                    {{ formatDateTime(purchase.saleDate) }}
                  </span>
                </div>
              </div>

              <!-- Liste des produits -->
              <div class="p-4">
                <div v-if="purchase.items && purchase.items.length > 0" class="space-y-2">
                  <div
                    v-for="item in purchase.items"
                    :key="item.id"
                    class="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <div class="flex-1">
                      <div class="font-medium">{{ item.productName }}</div>
                      <div v-if="item.variation" class="text-xs text-muted-foreground">
                        {{ item.variation }}
                      </div>
                      <div class="text-sm text-muted-foreground flex items-center gap-2">
                        <span>Qté: {{ item.quantity }} × {{ formatPrice(parseFloat(item.unitPrice)) }}</span>
                        <Badge v-if="item.discount && parseFloat(item.discount) > 0" variant="outline" class="text-xs">
                          Remise {{ item.discountType === '%' ? `${item.discount}%` : `${formatPrice(parseFloat(item.discount))}` }}
                        </Badge>
                      </div>
                    </div>
                    <div class="text-right font-medium">
                      {{ formatPrice(parseFloat(item.totalTTC)) }}
                    </div>
                  </div>
                </div>
              <div v-else class="text-sm text-muted-foreground text-center py-2">
                Chargement des produits...
              </div>

              <!-- Total -->
              <div class="flex items-center justify-between pt-3 mt-3 border-t font-bold">
                <span>Total</span>
                <span class="text-lg">{{ formatPrice(parseFloat(purchase.totalTTC)) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- État vide -->
        <EmptyState
          v-else
          :icon="ShoppingBag"
          title="Aucun achat"
          description="Ce client n'a pas encore effectué d'achat"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, onMounted, computed, watch } from 'vue'
import { Loader2, Star, TrendingUp, ShoppingBag } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PageHeader from '@/components/common/PageHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const toast = useToast()
const loading = ref(false)
const loadingClient = ref(true)
const loadingPostalCode = ref(false)
const postalCodeError = ref('')
const availableCities = ref<Array<{ nom: string; code: string }>>([])
const showPurchaseHistory = ref(false)
const loadingPurchases = ref(false)
const purchases = ref<any[]>([])

// Fonction pour formater les prix
function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price)
}

// Fonction pour formater les dates
function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ID du client depuis l'URL
const clientId = computed(() => parseInt(route.params.id as string))

// Formulaire
const form = ref<any>(null)

// Statistiques du client
const clientStats = ref({
  totalRevenue: 0,
  loyaltyPoints: 0,
  purchaseCount: 0,
})

// Watcher pour charger l'historique quand la modale s'ouvre
watch(showPurchaseHistory, (isOpen) => {
  if (isOpen && purchases.value.length === 0) {
    loadPurchaseHistory()
  }
})

// Debounce timer for postal code lookup
let postalCodeTimeout: NodeJS.Timeout

// Sélectionner une ville depuis le dropdown
function selectCity(cityName: string) {
  if (!form.value) return
  form.value.city = cityName
  // Fermer le dropdown après sélection
  availableCities.value = []
}

// Recherche automatique de la ville via code postal
async function handlePostalCodeChange() {
  if (!form.value) return

  const postalCode = form.value.postalCode.trim()

  // Reset error et villes disponibles
  postalCodeError.value = ''
  availableCities.value = []

  // Clear previous timeout
  clearTimeout(postalCodeTimeout)

  // Si code postal vide ou trop court, on ne fait rien
  if (!postalCode || postalCode.length < 4) {
    return
  }

  // Debounce de 500ms
  postalCodeTimeout = setTimeout(async () => {
    try {
      loadingPostalCode.value = true

      // API française des codes postaux
      const response = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,code,codesPostaux,centre&format=json&geometry=centre`)

      if (!response.ok) {
        throw new Error('Code postal non trouvé')
      }

      const data = await response.json()

      if (data && data.length > 0) {
        // Stocker toutes les villes disponibles
        availableCities.value = data

        // Sélectionner automatiquement la première ville
        form.value.city = data[0].nom

        // Si une seule ville, pas besoin d'afficher le menu
        if (data.length === 1) {
          availableCities.value = []
        }
      } else {
        postalCodeError.value = 'Code postal non trouvé'
      }
    } catch (error) {
      console.error('Erreur lors de la recherche du code postal:', error)
      postalCodeError.value = 'Impossible de trouver la ville'
    } finally {
      loadingPostalCode.value = false
    }
  }, 500)
}

// Nom du client pour le titre
const clientName = computed(() => {
  if (!form.value) return 'Client'
  const parts = []
  if (form.value.firstName) parts.push(form.value.firstName)
  if (form.value.lastName) parts.push(form.value.lastName)
  return parts.length > 0 ? parts.join(' ') : 'Client'
})

// Charger le client
async function loadClient() {
  try {
    loadingClient.value = true

    const response = await $fetch(`/api/clients/${clientId.value}`)
    const client = response.client

    const metadata = client.metadata as any || {}

    // Pré-remplir le formulaire
    form.value = {
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      postalCode: metadata.postalCode || '',
      city: metadata.city || '',
      country: metadata.country || 'France',
      loyaltyProgram: client.loyaltyProgram || false,
      discount: parseFloat(client.discount || '0'),
      gdprConsent: client.gdprConsent || false,
      marketingConsent: client.marketingConsent || false,
      authorizeSms: metadata.authorizeSms || false,
      notes: client.notes || '',
      alerts: client.alerts || '',
    }

    // Charger les statistiques du client
    await loadClientStats()
  } catch (error: any) {
    console.error('Erreur lors du chargement du client:', error)
    toast.error(error.data?.message || 'Erreur lors du chargement du client')
    navigateTo('/clients')
  } finally {
    loadingClient.value = false
  }
}

// Charger les statistiques du client
async function loadClientStats() {
  try {
    const response = await $fetch(`/api/clients/${clientId.value}/stats`)
    clientStats.value = {
      totalRevenue: response.totalRevenue || 0,
      loyaltyPoints: response.loyaltyPoints || 0,
      purchaseCount: response.purchaseCount || 0,
    }
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error)
    // Ne pas bloquer le chargement de la page si les stats échouent
  }
}

// Charger l'historique des achats
async function loadPurchaseHistory() {
  try {
    loadingPurchases.value = true
    const response = await $fetch(`/api/clients/${clientId.value}/purchases`)
    purchases.value = response.purchases || []
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error)
    toast.error('Impossible de charger l\'historique des achats')
  } finally {
    loadingPurchases.value = false
  }
}

// Soumission du formulaire
async function handleSubmit() {
  // Validation
  if (!form.value.gdprConsent) {
    toast.error('Le consentement RGPD est obligatoire')
    return
  }

  try {
    loading.value = true

    await $fetch(`/api/clients/${clientId.value}`, {
      method: 'PUT',
      body: {
        firstName: form.value.firstName || null,
        lastName: form.value.lastName || null,
        email: form.value.email || null,
        phone: form.value.phone || null,
        address: form.value.address || null,
      metadata: {
        postalCode: form.value.postalCode || null,
        city: form.value.city || null,
        country: form.value.country || 'France',
        authorizeSms: form.value.authorizeSms,
      },
      gdprConsent: !!form.value.gdprConsent,
      marketingConsent: !!form.value.marketingConsent,
      loyaltyProgram: !!form.value.loyaltyProgram,
        discount: form.value.discount || 0,
        notes: form.value.notes || null,
        alerts: form.value.alerts || null,
      },
    })

    toast.success('Client modifié avec succès')
    navigateTo('/clients')
  } catch (error: any) {
    console.error('Erreur lors de la modification du client:', error)
    toast.error(error.data?.message || 'Erreur lors de la modification du client')
  } finally {
    loading.value = false
  }
}

// Charger au montage
onMounted(() => {
  loadClient()
})
</script>
