<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})

import { ref, computed, watch, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Building2 } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import PeriodPicker from '@/components/statistiques/PeriodPicker.vue'
import SellersTable from '@/components/statistiques/SellersTable.vue'
import EstablishmentMultiSelect from '@/components/sellers/EstablishmentMultiSelect.vue'

interface SellerStat {
  sellerId: number
  sellerName: string
  ticketCount: number
  totalTTC: number
  totalHT: number
  totalQuantity: number
  avgBasketValue: number
  totalMargin: number
  marginPct: number | null
}

interface Response {
  success: boolean
  period: { startDate: string; endDate: string }
  sellers: SellerStat[]
}

function defaultPeriod() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

const period = ref(defaultPeriod())
const selectedEstablishmentIds = ref<number[]>([])
const data = ref<Response | null>(null)
const loading = ref(false)
const error = ref('')

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      startDate: period.value.startDate,
      endDate: period.value.endDate,
    })
    if (selectedEstablishmentIds.value.length > 0) {
      params.set('establishmentId', selectedEstablishmentIds.value.join(','))
    }
    data.value = await $fetch<Response>(`/api/stats/sellers?${params.toString()}`)
  } catch (e: unknown) {
    console.error('Erreur stats vendeurs:', e)
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
    data.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => loadStats())
watch([period, selectedEstablishmentIds], () => loadStats(), { deep: true })

const establishmentFilterLabel = computed(() => {
  const n = selectedEstablishmentIds.value.length
  if (n === 0) return 'Tous les établissements'
  return `${n} établissement${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}`
})
</script>

<template>
  <div class="p-6 space-y-6">
    <PageHeader
      title="Vendeurs"
      description="Classement des vendeurs et performance individuelle sur la période"
    >
      <template #actions>
        <Dialog>
          <DialogTrigger as-child>
            <Button variant="outline" size="sm">
              <Building2 class="w-4 h-4 mr-2" />
              {{ establishmentFilterLabel }}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filtrer par établissement</DialogTitle>
              <DialogDescription>
                Laisser tout décoché pour inclure tous les établissements du compte.
              </DialogDescription>
            </DialogHeader>
            <div class="py-2">
              <EstablishmentMultiSelect
                v-model="selectedEstablishmentIds"
                label=""
              />
            </div>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <div class="border rounded-lg p-3 bg-card">
      <PeriodPicker v-model="period" />
    </div>

    <div v-if="loading" class="text-center py-12 text-muted-foreground">
      Chargement…
    </div>

    <div v-else-if="error" class="text-center py-12 text-destructive">
      {{ error }}
    </div>

    <SellersTable v-else-if="data" :sellers="data.sellers" />
  </div>
</template>
