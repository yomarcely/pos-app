<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { CheckCircle2, ChevronRight, Store, Monitor, Package, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
import { useToast } from '@/composables/useToast'

definePageMeta({
  layout: 'auth',
})

interface TaxRate {
  id: number
  name: string
  rate: string
  code: string
  isDefault: boolean | null
}

interface Establishment {
  id: number
  name: string
}

const auth = useAuthStore()
const onboarding = useOnboardingStore()
const toast = useToast()
const router = useRouter()

type StepId = 1 | 2 | 3
const currentStep = ref<StepId>(1)
const submitting = ref(false)
const taxRates = ref<TaxRate[]>([])
const createdEstablishmentId = ref<number | null>(null)

const userName = computed(() => {
  const meta = (auth.user?.user_metadata || {}) as Record<string, unknown>
  return (meta.name as string) || auth.user?.email?.split('@')[0] || ''
})

// ----- Step 1 : Établissement (tous champs obligatoires NF525) -----
const establishment = reactive({
  name: userName.value ? `${userName.value} — Boutique` : '',
  address: '',
  postalCode: '',
  city: '',
  siret: '',
  naf: '',
  tvaNumber: '',
})

const establishmentErrors = reactive<Record<string, string | null>>({
  name: null,
  address: null,
  postalCode: null,
  city: null,
  siret: null,
  naf: null,
  tvaNumber: null,
})

function validateEstablishment(): boolean {
  let ok = true
  const reset = (k: keyof typeof establishmentErrors, msg: string | null) => { establishmentErrors[k] = msg }

  reset('name', establishment.name.trim() ? null : 'Le nom est requis')
  reset('address', establishment.address.trim() ? null : 'L\'adresse est requise')
  reset('postalCode', /^\d{5}$/.test(establishment.postalCode.trim()) ? null : 'Code postal invalide (5 chiffres)')
  reset('city', establishment.city.trim() ? null : 'La ville est requise')
  reset('siret', /^\d{14}$/.test(establishment.siret.trim()) ? null : 'SIRET invalide (14 chiffres)')
  reset('naf', /^\d{4}[A-Z]$/.test(establishment.naf.trim().toUpperCase()) ? null : 'Code NAF invalide (format 1234A)')
  reset('tvaNumber', /^[A-Z]{2}\d{11}$/.test(establishment.tvaNumber.trim().toUpperCase()) ? null : 'Numéro de TVA invalide (format FR12345678901)')

  ok = Object.values(establishmentErrors).every(v => v === null)
  return ok
}

// ----- Step 2 : Caisse -----
const register = reactive({
  name: 'Caisse principale',
})

const registerValid = computed(() => register.name.trim().length > 0)

// ----- Step 3 : Premier produit -----
const product = reactive({
  name: '',
  price: '' as string,
  tvaId: null as number | null,
})

const productValid = computed(() => product.name.trim().length > 0 && Number(product.price) > 0 && product.tvaId !== null)

onMounted(async () => {
  // Seed silencieux (vendeur + TVA) avant d'afficher le wizard
  await onboarding.ensureSeeded()
  await loadTaxRates()
  await onboarding.fetchStatus()

  if (onboarding.isComplete) {
    router.replace('/dashboard')
    return
  }

  // Reprise après skip : aller à la première étape incomplète
  if (onboarding.status?.hasEstablishment) {
    currentStep.value = onboarding.status?.hasRegister ? 3 : 2
    // Charger l'établissement existant pour pouvoir y rattacher la caisse
    if (!onboarding.status?.hasRegister) {
      await loadFirstEstablishment()
    }
  }
})

async function loadTaxRates() {
  try {
    const rates = await $fetch<TaxRate[]>('/api/tax-rates')
    taxRates.value = rates
    const def = rates.find(r => r.isDefault) || rates[0]
    if (def) product.tvaId = def.id
  } catch (err) {
    console.error('[Onboarding] loadTaxRates error', err)
  }
}

async function loadFirstEstablishment() {
  try {
    const res = await $fetch<{ success: boolean; establishments: Establishment[] } | Establishment[]>('/api/establishments')
    const list = Array.isArray(res) ? res : res.establishments
    if (list && list[0]) createdEstablishmentId.value = list[0].id
  } catch (err) {
    console.error('[Onboarding] loadFirstEstablishment error', err)
  }
}

async function submitEstablishment() {
  if (submitting.value) return
  if (!validateEstablishment()) return
  submitting.value = true
  try {
    const res = await $fetch<{ success: boolean; establishment: Establishment }>('/api/establishments/create', {
      method: 'POST',
      body: {
        name: establishment.name.trim(),
        address: establishment.address.trim(),
        postalCode: establishment.postalCode.trim(),
        city: establishment.city.trim(),
        country: 'France',
        siret: establishment.siret.trim(),
        naf: establishment.naf.trim().toUpperCase(),
        tvaNumber: establishment.tvaNumber.trim().toUpperCase(),
      },
    })
    createdEstablishmentId.value = res.establishment?.id ?? null
    toast.success('Établissement créé')
    // Re-run du seed pour rattacher le vendeur seedé au nouvel établissement
    await onboarding.runSeed()
    await onboarding.fetchStatus()
    currentStep.value = 2
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors de la création'
    toast.error('Impossible de créer l\'établissement', msg)
  } finally {
    submitting.value = false
  }
}

async function submitRegister() {
  if (submitting.value || !registerValid.value) return
  if (!createdEstablishmentId.value) {
    toast.error('Aucun établissement trouvé', 'Retournez à l\'étape précédente.')
    return
  }
  submitting.value = true
  try {
    await $fetch('/api/registers/create', {
      method: 'POST',
      body: {
        establishmentId: createdEstablishmentId.value,
        name: register.name.trim(),
      },
    })
    toast.success('Caisse créée')
    await onboarding.fetchStatus()
    currentStep.value = 3
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors de la création'
    toast.error('Impossible de créer la caisse', msg)
  } finally {
    submitting.value = false
  }
}

async function submitProduct() {
  if (!productValid.value || submitting.value) return
  if (!createdEstablishmentId.value) {
    toast.error('Établissement manquant', 'Recommencez depuis l\'étape 1.')
    return
  }
  submitting.value = true
  try {
    // Le query param ?establishmentId déclenche la création du stock initial
    // dans product_stocks, sans quoi le produit n'apparaît pas dans /produits
    // quand un établissement est sélectionné dans le header.
    await $fetch(`/api/products/create?establishmentId=${createdEstablishmentId.value}`, {
      method: 'POST',
      body: {
        name: product.name.trim(),
        price: product.price,
        tvaId: product.tvaId,
        stock: 0,
        minStock: 0,
      },
    })
    toast.success('Produit créé', 'Votre configuration est terminée 🎉')
    await onboarding.fetchStatus()
    onboarding.setSkipped(false)
    router.push('/dashboard')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors de la création'
    toast.error('Impossible de créer le produit', msg)
  } finally {
    submitting.value = false
  }
}

function skipWizard() {
  onboarding.setSkipped(true)
  router.push('/dashboard')
}

const steps = [
  { id: 1 as const, label: 'Établissement', icon: Store },
  { id: 2 as const, label: 'Caisse', icon: Monitor },
  { id: 3 as const, label: 'Premier produit', icon: Package },
]

const stepStatus = computed(() => ({
  1: !!onboarding.status?.hasEstablishment,
  2: !!onboarding.status?.hasRegister,
  3: !!onboarding.status?.hasProduct,
}))
</script>

<template>
  <div class="min-h-svh bg-background text-foreground">
    <header class="border-b bg-card">
      <div class="container mx-auto flex h-16 items-center justify-between px-4">
        <div class="flex items-center gap-2 font-semibold">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles class="size-4" />
          </div>
          <span>Bienvenue sur FymPOS</span>
        </div>
        <Button variant="ghost" size="sm" @click="skipWizard">
          Plus tard
        </Button>
      </div>
    </header>

    <main class="container mx-auto max-w-2xl px-4 py-8 md:py-12">
      <!-- Stepper -->
      <div class="mb-8 flex items-center justify-center gap-3 md:gap-4">
        <template v-for="(step, idx) in steps" :key="step.id">
          <div class="flex items-center gap-2">
            <div
              class="flex size-9 items-center justify-center rounded-full font-semibold transition-colors"
              :class="[
                stepStatus[step.id]
                  ? 'bg-emerald-600 text-white'
                  : currentStep === step.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
              ]"
            >
              <CheckCircle2 v-if="stepStatus[step.id]" class="size-5" />
              <span v-else>{{ step.id }}</span>
            </div>
            <span class="hidden text-sm font-medium sm:inline" :class="currentStep === step.id ? 'text-foreground' : 'text-muted-foreground'">
              {{ step.label }}
            </span>
          </div>
          <ChevronRight v-if="idx < steps.length - 1" class="size-5 text-muted-foreground" />
        </template>
      </div>

      <!-- Étape 1 : Établissement -->
      <Card v-if="currentStep === 1">
        <CardHeader>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Store class="size-5" />
            </div>
            <div>
              <CardTitle>Votre établissement</CardTitle>
              <CardDescription>
                Ces informations sont obligatoires pour générer des tickets de caisse et des factures conformes à la réglementation française.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="submitEstablishment">
            <FieldGroup>
              <Field>
                <FieldLabel for="est-name">Nom de l'établissement *</FieldLabel>
                <Input
                  id="est-name"
                  v-model="establishment.name"
                  placeholder="Ma Boutique"
                  autofocus
                />
                <FieldError v-if="establishmentErrors.name">{{ establishmentErrors.name }}</FieldError>
              </Field>

              <Field>
                <FieldLabel for="est-address">Adresse *</FieldLabel>
                <Input
                  id="est-address"
                  v-model="establishment.address"
                  placeholder="12 rue de la République"
                />
                <FieldError v-if="establishmentErrors.address">{{ establishmentErrors.address }}</FieldError>
              </Field>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field class="sm:col-span-1">
                  <FieldLabel for="est-postal">Code postal *</FieldLabel>
                  <Input
                    id="est-postal"
                    v-model="establishment.postalCode"
                    inputmode="numeric"
                    maxlength="5"
                    placeholder="75001"
                  />
                  <FieldError v-if="establishmentErrors.postalCode">{{ establishmentErrors.postalCode }}</FieldError>
                </Field>
                <Field class="sm:col-span-2">
                  <FieldLabel for="est-city">Ville *</FieldLabel>
                  <Input id="est-city" v-model="establishment.city" placeholder="Paris" />
                  <FieldError v-if="establishmentErrors.city">{{ establishmentErrors.city }}</FieldError>
                </Field>
              </div>

              <Field>
                <FieldLabel for="est-siret">SIRET *</FieldLabel>
                <Input
                  id="est-siret"
                  v-model="establishment.siret"
                  inputmode="numeric"
                  maxlength="14"
                  placeholder="12345678901234"
                />
                <FieldDescription>14 chiffres, sans espace. Figure sur l'avis de situation INSEE.</FieldDescription>
                <FieldError v-if="establishmentErrors.siret">{{ establishmentErrors.siret }}</FieldError>
              </Field>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel for="est-naf">Code NAF/APE *</FieldLabel>
                  <Input
                    id="est-naf"
                    v-model="establishment.naf"
                    maxlength="5"
                    placeholder="4711F"
                    @input="(event: Event) => { establishment.naf = (event.target as HTMLInputElement).value.toUpperCase() }"
                  />
                  <FieldDescription>Format 1234A (4 chiffres + 1 lettre).</FieldDescription>
                  <FieldError v-if="establishmentErrors.naf">{{ establishmentErrors.naf }}</FieldError>
                </Field>
                <Field>
                  <FieldLabel for="est-tva">N° TVA intracommunautaire *</FieldLabel>
                  <Input
                    id="est-tva"
                    v-model="establishment.tvaNumber"
                    maxlength="13"
                    placeholder="FR12345678901"
                    @input="(event: Event) => { establishment.tvaNumber = (event.target as HTMLInputElement).value.toUpperCase() }"
                  />
                  <FieldDescription>Format FR + 11 chiffres.</FieldDescription>
                  <FieldError v-if="establishmentErrors.tvaNumber">{{ establishmentErrors.tvaNumber }}</FieldError>
                </Field>
              </div>

              <div class="flex gap-3 pt-2">
                <Button type="button" variant="outline" class="flex-1" @click="skipWizard">
                  Plus tard
                </Button>
                <Button type="submit" class="flex-1" :disabled="submitting">
                  {{ submitting ? 'Création...' : 'Continuer' }}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <!-- Étape 2 : Caisse -->
      <Card v-else-if="currentStep === 2">
        <CardHeader>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Monitor class="size-5" />
            </div>
            <div>
              <CardTitle>Votre première caisse</CardTitle>
              <CardDescription>
                Une caisse correspond à un poste d'encaissement. Son numéro figurera sur vos tickets NF525.
                Vous pourrez en ajouter d'autres plus tard depuis Paramètres.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="submitRegister">
            <FieldGroup>
              <Field>
                <FieldLabel for="reg-name">Nom de la caisse *</FieldLabel>
                <Input
                  id="reg-name"
                  v-model="register.name"
                  placeholder="Caisse principale"
                  autofocus
                  required
                />
                <FieldDescription>
                  Exemple : « Caisse principale », « Comptoir », « Mobile »…
                </FieldDescription>
              </Field>

              <div class="flex gap-3 pt-2">
                <Button type="button" variant="outline" @click="currentStep = 1">
                  Retour
                </Button>
                <Button type="submit" class="flex-1" :disabled="!registerValid || submitting">
                  {{ submitting ? 'Création...' : 'Continuer' }}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <!-- Étape 3 : Premier produit -->
      <Card v-else>
        <CardHeader>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Package class="size-5" />
            </div>
            <div>
              <CardTitle>Votre premier produit</CardTitle>
              <CardDescription>
                Le minimum pour passer votre première vente. Vous pourrez en ajouter d'autres ensuite depuis le catalogue.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="submitProduct">
            <FieldGroup>
              <Field>
                <FieldLabel for="prod-name">Nom du produit *</FieldLabel>
                <Input
                  id="prod-name"
                  v-model="product.name"
                  placeholder="Café expresso"
                  autofocus
                  required
                />
              </Field>
              <Field>
                <FieldLabel for="prod-price">Prix de vente TTC (€) *</FieldLabel>
                <Input
                  id="prod-price"
                  v-model="product.price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="2.50"
                  required
                />
              </Field>
              <Field>
                <FieldLabel for="prod-tva">Taux de TVA *</FieldLabel>
                <Select v-model="product.tvaId">
                  <SelectTrigger id="prod-tva">
                    <SelectValue placeholder="Sélectionner un taux" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="rate in taxRates" :key="rate.id" :value="rate.id">
                      {{ rate.name }} ({{ rate.rate }}%)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div class="flex gap-3 pt-2">
                <Button type="button" variant="outline" @click="currentStep = 2">
                  Retour
                </Button>
                <Button type="submit" class="flex-1" :disabled="!productValid || submitting">
                  {{ submitting ? 'Création...' : 'Terminer' }}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <p class="mt-6 text-center text-xs text-muted-foreground">
        Vous pouvez accéder au reste de l'application à tout moment via « Plus tard ».
      </p>
    </main>
  </div>
</template>
