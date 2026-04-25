<template>
  <div class="p-6 space-y-6 max-w-3xl">
    <PageHeader
      title="Programme de fidélité"
      description="Configurez le système de points et les avantages clients."
    />

    <LoadingSpinner v-if="loading" text="Chargement..." />

    <div v-else class="space-y-6">
      <!-- Activation -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Activation</CardTitle>
              <CardDescription>
                Active ou désactive le programme de fidélité pour tout le tenant.
              </CardDescription>
            </div>
            <Switch v-model="form.enabled" :disabled="saving" />
          </div>
        </CardHeader>
      </Card>

      <!-- Calcul des points -->
      <Card :class="{ 'opacity-60 pointer-events-none': !form.enabled }">
        <CardHeader>
          <CardTitle>Calcul des points</CardTitle>
          <CardDescription>
            Comment les clients accumulent-ils leurs points ?
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label>Méthode</Label>
            <Select v-model="form.pointMode">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per_euro">1 € dépensé = 1 point (arrondi inférieur)</SelectItem>
                <SelectItem value="per_ticket">1 ticket validé = 1 point</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="threshold">Points à atteindre pour déclencher l'avantage</Label>
            <Input
              id="threshold"
              v-model.number="form.thresholdPoints"
              type="number"
              min="1"
              step="1"
            />
          </div>
        </CardContent>
      </Card>

      <!-- Avantage -->
      <Card :class="{ 'opacity-60 pointer-events-none': !form.enabled }">
        <CardHeader>
          <CardTitle>Avantage client</CardTitle>
          <CardDescription>
            Type de récompense déclenchée quand le seuil est atteint.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label>Type d'avantage</Label>
            <Select v-model="form.rewardType">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent_discount">Remise en %</SelectItem>
                <SelectItem value="euro_discount">Rabais en €</SelectItem>
                <SelectItem value="voucher">Bon d'achat (utilisable plus tard)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="rewardValue">{{ rewardValueLabel }}</Label>
            <Input
              id="rewardValue"
              v-model.number="form.rewardValue"
              type="number"
              min="0.01"
              step="0.01"
            />
          </div>

          <div v-if="form.rewardType === 'voucher'" class="space-y-2">
            <Label for="voucherValidityDays">Durée de validité du bon (en jours)</Label>
            <Input
              id="voucherValidityDays"
              v-model.number="form.voucherValidityDays"
              type="number"
              min="1"
              step="1"
            />
            <p class="text-xs text-muted-foreground">
              Au-delà de cette durée, le bon ne pourra plus être utilisé.
            </p>
          </div>
        </CardContent>
      </Card>

      <div class="flex items-center justify-end gap-2">
        <Button variant="outline" @click="loadConfig" :disabled="saving">Annuler</Button>
        <Button @click="save" :disabled="saving">
          <Spinner v-if="saving" class="size-4 mr-2" />
          Enregistrer
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

import { ref, reactive, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useToast } from '@/composables/useToast'
import { extractFetchError } from '@/composables/useFetchError'

type PointMode = 'per_euro' | 'per_ticket'
type RewardType = 'percent_discount' | 'euro_discount' | 'voucher'

interface LoyaltyConfig {
  enabled: boolean
  pointMode: PointMode
  thresholdPoints: number
  rewardType: RewardType
  rewardValue: number
  voucherValidityDays: number
}

const toast = useToast()
const loading = ref(true)
const saving = ref(false)

const form = reactive<LoyaltyConfig>({
  enabled: false,
  pointMode: 'per_euro',
  thresholdPoints: 100,
  rewardType: 'percent_discount',
  rewardValue: 5,
  voucherValidityDays: 60,
})

const rewardValueLabel = computed(() => {
  if (form.rewardType === 'percent_discount') return 'Pourcentage de remise (%)'
  if (form.rewardType === 'euro_discount') return 'Montant du rabais (€)'
  return 'Montant du bon d\'achat (€)'
})

async function loadConfig() {
  try {
    loading.value = true
    const response = await $fetch<{ success: boolean, config: LoyaltyConfig }>('/api/loyalty/config')
    Object.assign(form, response.config)
  }
  catch (error) {
    toast.error(extractFetchError(error, 'Erreur lors du chargement de la configuration'))
  }
  finally {
    loading.value = false
  }
}

async function save() {
  try {
    saving.value = true
    const response = await $fetch<{ success: boolean, config: LoyaltyConfig }>('/api/loyalty/config', {
      method: 'PUT',
      body: { ...form },
    })
    Object.assign(form, response.config)
    toast.success('Configuration enregistrée')
  }
  catch (error) {
    toast.error(extractFetchError(error, 'Erreur lors de l\'enregistrement'))
  }
  finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>
