<template>
  <Card>
    <CardHeader>
      <CardTitle>Tarification</CardTitle>
      <CardDescription>Définissez les prix de vente et d'achat</CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="grid gap-4 md:grid-cols-3">
        <!-- Prix d'achat -->
        <div class="space-y-2">
          <Label for="purchasePrice">Prix d'achat HT</Label>
          <div class="relative">
            <Input
              id="purchasePrice"
              type="number"
              step="0.01"
              :model-value="form.purchasePrice"
              placeholder="0.00"
              class="pr-8"
              @update:model-value="handlePurchasePriceChange"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
          </div>
        </div>

        <!-- Coef -->
        <div class="space-y-2">
          <Label for="coef">Coef</Label>
          <Input
            id="coef"
            type="number"
            step="0.01"
            min="0"
            :model-value="coef"
            placeholder="1.00"
            @update:model-value="handleCoefChange"
          />
          <p class="text-xs text-muted-foreground">Modifier le coef ajuste automatiquement le prix TTC.</p>
        </div>

        <!-- Prix de vente -->
        <div class="space-y-2">
          <Label for="price">Prix de vente TTC *</Label>
          <div class="relative">
            <Input
              id="price"
              type="number"
              step="0.01"
              :model-value="form.price"
              placeholder="0.00"
              class="pr-8"
              @update:model-value="handlePriceChange"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
          </div>
        </div>
      </div>

      <!-- TVA -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label for="tva">TVA *</Label>
          <Button
            variant="ghost"
            size="sm"
            @click="navigateTo('/tva')"
            class="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Gérer les taux
          </Button>
        </div>
        <Select :model-value="normalizedTva" @update:model-value="handleTaxRateChange">
          <SelectTrigger id="tva">
            <SelectValue placeholder="Sélectionner un taux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-if="taxRatesLoading" value="" disabled>
              Chargement...
            </SelectItem>
            <SelectItem v-else-if="!taxRates?.length" value="" disabled>
              Aucun taux de TVA
            </SelectItem>
            <SelectItem
              v-for="rate in taxRates"
              :key="rate.id"
              :value="normalizeRate(rate.rate)"
            >
              {{ rate.name }} ({{ rate.rate }}%) - {{ rate.code }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Aperçu de la marge -->
      <div v-if="form.price && form.purchasePrice" class="p-4 bg-muted rounded-lg space-y-2">
        <p class="text-sm font-medium">Aperçu de la marge</p>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-muted-foreground">Marge brute</p>
            <p class="font-medium">{{ margin.toFixed(2) }} €</p>
          </div>
          <div>
            <p class="text-muted-foreground">Taux de marge</p>
            <p class="font-medium" :class="marginRate > 0 ? 'text-green-600' : 'text-red-600'">
              {{ marginRate.toFixed(2) }}%
            </p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

interface PricingForm {
  price: string
  purchasePrice: string
  tva: string
  tvaId: number | null
  categoryId: string | null
  coef?: string | number
}

interface TaxRate {
  id: number
  name: string
  code: string
  rate: string
  description: string | null
  isDefault: boolean
}

const props = defineProps<{
  form: PricingForm
}>()

const emit = defineEmits<{
  'update:form': [value: PricingForm]
}>()

// Récupérer les taux de TVA
const { data: taxRates, pending: taxRatesLoading } = await useFetch<TaxRate[]>('/api/tax-rates')

// Normaliser le taux (convertir "20.00" en "20" pour la comparaison)
function normalizeRate(rate: string | number): string {
  return parseFloat(String(rate)).toString()
}

// Computed pour normaliser la valeur de TVA du formulaire
const normalizedTva = computed(() => {
  if (!props.form.tva) return ''
  return normalizeRate(props.form.tva)
})

const coef = computed({
  get() {
    const purchase = parseFloat(props.form.purchasePrice) || 0
    const priceTTC = parseFloat(props.form.price) || 0
    if (purchase > 0 && priceTTC > 0) {
      return Number((priceTTC / purchase).toFixed(2))
    }
    return ''
  },
  set(value: string | number) {
    const parsed = typeof value === 'number' ? value : parseFloat(value)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return
    }
    const purchase = parseFloat(props.form.purchasePrice) || 0
    if (purchase > 0) {
      const newPrice = purchase * parsed
      emitUpdate({ price: String(newPrice) })
    }
  }
})

function emitUpdate(partial: Partial<PricingForm>) {
  emit('update:form', { ...props.form, ...partial })
}

function handlePurchasePriceChange(value: string | number) {
  emitUpdate({ purchasePrice: String(value) })
}

function handlePriceChange(value: string | number) {
  emitUpdate({ price: String(value) })
}

function handleCoefChange(value: string | number) {
  coef.value = value
}

function handleTaxRateChange(rateValue: any) {
  if (!rateValue || typeof rateValue === 'boolean' || typeof rateValue === 'object') return

  const normalizedValue = normalizeRate(String(rateValue))
  const selectedRate = taxRates.value?.find(r => normalizeRate(r.rate) === normalizedValue)

  emitUpdate({
    tva: String(rateValue),
    tvaId: selectedRate?.id || null
  })
}

const margin = computed(() => {
  const price = parseFloat(props.form.price) || 0
  const purchasePrice = parseFloat(props.form.purchasePrice) || 0
  return price - purchasePrice
})

const marginRate = computed(() => {
  const purchasePrice = parseFloat(props.form.purchasePrice) || 0
  if (purchasePrice === 0) return 0
  return (margin.value / purchasePrice) * 100
})
</script>
