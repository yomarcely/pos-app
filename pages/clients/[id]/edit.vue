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

import { computed, onMounted } from 'vue'
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
import { useClientEditor } from '@/composables/useClientEditor'
import { useClientPurchaseHistory } from '@/composables/useClientPurchaseHistory'
import { usePostalCodeLookup } from '@/composables/usePostalCodeLookup'

const route = useRoute()
const clientId = computed(() => parseInt(route.params.id as string))

const { form, loading, loadingClient, clientStats, clientName, loadClient, handleSubmit } = useClientEditor(clientId)
const { purchases, loadingPurchases, showPurchaseHistory } = useClientPurchaseHistory(clientId)
const { loadingPostalCode, postalCodeError, availableCities, handlePostalCodeChange, selectCity } = usePostalCodeLookup(form)

function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price)
}

function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  loadClient()
})
</script>
