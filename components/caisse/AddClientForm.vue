<script setup lang="ts">
import { ref } from 'vue'
import {
  DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/composables/useToast'
import { useCustomerStore } from '@/stores/customer'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { Loader2 } from 'lucide-vue-next'

const { success, error: showError } = useToast()
const customerStore = useCustomerStore()
const { selectedEstablishmentId } = useEstablishmentRegister()

const emit = defineEmits<{
  success: [customer: any]
}>()

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  postalCode: '',
  city: '',
  country: 'France',
  loyaltyProgram: false,
  discount: 0,
  gdprConsent: false,
  marketingConsent: false,
  authorizeSms: false,
  notes: '',
  alerts: '',
})

const loading = ref(false)
const loadingPostalCode = ref(false)
const postalCodeError = ref('')
const availableCities = ref<Array<{ nom: string; code: string }>>([])

// Debounce timer for postal code lookup
let postalCodeTimeout: NodeJS.Timeout

// Sélectionner une ville depuis le dropdown
function selectCity(cityName: string) {
  form.value.city = cityName
  // Fermer le dropdown après sélection
  availableCities.value = []
}

// Recherche automatique de la ville via code postal
async function handlePostalCodeChange() {
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

async function submitClient() {
  // Validation
  if (!form.value.gdprConsent) {
    showError('Erreur', 'Le consentement RGPD est obligatoire')
    return
  }

  loading.value = true

  try {
    const client = await $fetch('/api/clients', {
      method: 'POST',
      params: selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined,
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

    success('Client créé', `${form.value.firstName} ${form.value.lastName} a été ajouté avec succès`)

    // Émettre l'événement de succès avec le client créé
    emit('success', client)

    // Réinitialiser le formulaire
    form.value = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      postalCode: '',
      city: '',
      country: 'France',
      loyaltyProgram: false,
      discount: 0,
      gdprConsent: false,
      marketingConsent: false,
      authorizeSms: false,
      notes: '',
      alerts: '',
    }
  } catch (err: any) {
    console.error('Erreur lors de la création du client:', err)
    showError('Erreur', err.data?.message || 'Impossible de créer le client')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <DialogContent class="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Nouveau client</DialogTitle>
      <DialogDescription>
        Remplissez les informations du client puis cliquez sur "Enregistrer".
      </DialogDescription>
    </DialogHeader>

    <form @submit.prevent="submitClient" class="space-y-6 py-4">
      <!-- Informations personnelles -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Informations personnelles</h3>

        <div class="grid grid-cols-2 gap-4">
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

          <div class="grid grid-cols-3 gap-4">
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

        <div class="grid grid-cols-2 gap-4">
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

        <div class="grid grid-cols-2 gap-4">
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

      <!-- Bouton -->
      <div class="flex justify-end pt-4 border-t">
        <DialogFooter>
          <Button type="submit" :disabled="loading || !form.gdprConsent">
            <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
            Enregistrer
          </Button>
        </DialogFooter>
      </div>
    </form>
  </DialogContent>
</template>
